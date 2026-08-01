import { defineEventHandler, readRawBody, createError, getHeader } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { hmacSha256, timingSafeEqual } from '~~/server/utils/crypto'
import {
  limitRecords,
  limitReasonTags,
  marketDailySummary,
  sectorDailyStats,
  ingestRuns,
  stocks,
  sectors,
  concepts
} from '~~/server/db/schema'

/**
 * 采集器入口（B主：GitHub Actions / A备：本地脚本）。
 * 鉴权：Header `x-signature` = HMAC-SHA256(INGEST_SECRET, rawBody)。
 * 幂等：UNIQUE(trade_date, stock_code, limit_type) → 重复提交安全。
 * 人肉优先：is_verified=1 的记录永不被覆盖。
 */
export default defineEventHandler(async (event) => {
  const start = Date.now()
  const config = useRuntimeConfig(event)
  const secret = config.ingestSecret
  if (!secret) throw createError({ statusCode: 500, statusMessage: '服务端未配置 INGEST_SECRET' })

  const raw = (await readRawBody(event, 'utf8')) || ''
  const sig = getHeader(event, 'x-signature') || ''
  const expected = await hmacSha256(secret, raw)
  if (!sig || !timingSafeEqual(sig, expected))
    throw createError({ statusCode: 401, statusMessage: '签名校验失败' })

  let payload: any
  try {
    payload = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'JSON 解析失败' })
  }

  const tradeDate = String(payload.trade_date || '')
  const source = String(payload.source || 'unknown')
  const records = Array.isArray(payload.records) ? payload.records : []
  if (!tradeDate || !records.length)
    throw createError({ statusCode: 400, statusMessage: 'trade_date 与 records 必填' })

  const db = useDrizzle(event)
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const r of records) {
    const stockCode = String(r.stock_code || '')
    const limitType = String(r.limit_type || 'up')
    if (!stockCode) continue
    const where = and(
      eq(limitRecords.tradeDate, tradeDate),
      eq(limitRecords.stockCode, stockCode),
      eq(limitRecords.limitType, limitType)
    )
    const [existing] = await db.select().from(limitRecords).where(where).limit(1)

    // 人肉校订过的记录：永不覆盖
    if (existing?.isVerified) {
      skipped++
      continue
    }

    const now = new Date().toISOString()
    const values = {
      tradeDate,
      stockCode,
      stockName: String(r.stock_name || existing?.stockName || ''),
      board: String(r.board || existing?.board || 'main'),
      limitType,
      price: r.price ?? null,
      pct: r.pct ?? null,
      firstLimitTime: r.first_limit_time ?? null,
      lastLimitTime: r.last_limit_time ?? null,
      openTimes: r.open_times ?? 0,
      turnover: r.turnover ?? null,
      volume: r.volume ?? null,
      circMarketCap: r.circ_market_cap ?? null,
      totalMarketCap: r.total_market_cap ?? null,
      ztCount: r.zt_count ?? 1,
      reasonRaw: r.reason_raw ?? null,
      source,
      updatedAt: now
    }

    // 回填股票主数据字典（改名/换板自动跟随，历史名仍以 limit_records 快照为准）
    if (values.stockName) {
      await db
        .insert(stocks)
        .values({
          code: stockCode,
          name: values.stockName,
          board: values.board,
          isSt: /ST/i.test(values.stockName),
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: stocks.code,
          set: { name: values.stockName, board: values.board, isSt: /ST/i.test(values.stockName), updatedAt: now }
        })
    }

    let recordId: number
    if (existing) {
      await db.update(limitRecords).set(values).where(eq(limitRecords.id, existing.id))
      recordId = existing.id
      updated++
    } else {
      const ins = (await db
        .insert(limitRecords)
        .values({ ...values, reasonFinal: '', isVerified: false, createdAt: now })
        .returning())[0]
      if (!ins) continue
      recordId = ins.id
      inserted++
    }

    // 题材标签：非校订记录整体刷新（机器视角）
    await db.delete(limitReasonTags).where(eq(limitReasonTags.limitRecordId, recordId))
    for (const tag of Array.isArray(r.tags) ? r.tags : []) {
      const type = String(tag.type || 'concept')
      const tagId = String(tag.id || '')
      if (!tagId) continue

      // 顺手补齐字典表，前端展示名称时不用再回源
      if (type === 'sector') {
        await db.insert(sectors).values({ id: tagId, name: tagId, kind: 'industry' }).onConflictDoNothing()
      } else {
        await db.insert(concepts).values({ id: tagId, name: tagId }).onConflictDoNothing()
      }

      await db.insert(limitReasonTags).values({
        limitRecordId: recordId,
        conceptId: type === 'concept' ? tagId : null,
        sectorId: type === 'sector' ? tagId : null,
        tagType: type,
        weight: tag.weight ?? 1
      })
    }
  }

  // 重新汇总当日情绪 + 板块榜（写入派生表，首页直接读，避免主表实时 GROUP BY）
  await recomputeSummary(db, tradeDate)
  await recomputeSectorStats(db, tradeDate)

  const durationMs = Date.now() - start
  await db.insert(ingestRuns).values({
    source,
    tradeDate,
    status: 'success',
    fetched: records.length,
    inserted,
    updated,
    skipped,
    durationMs
  })

  return { ok: true, trade_date: tradeDate, stats: { fetched: records.length, inserted, updated, skipped, durationMs } }
})

/**
 * 重算某交易日板块榜。
 * 口径：limit_reason_tags 里 tag_type='sector' 的行业标签，按涨停家数聚合排名。
 * 采集器（akshare 涨停池「所属行业」）会带上这个标签；没有行业数据时该表为空，页面自动降级到题材榜。
 */
async function recomputeSectorStats(db: ReturnType<typeof useDrizzle>, tradeDate: string) {
  const rows = await db
    .select({
      sectorId: limitReasonTags.sectorId,
      cnt: sql<number>`count(*)`,
      avgPct: sql<number>`avg(${limitRecords.pct})`
    })
    .from(limitReasonTags)
    .innerJoin(limitRecords, eq(limitReasonTags.limitRecordId, limitRecords.id))
    .where(
      and(
        eq(limitRecords.tradeDate, tradeDate),
        eq(limitRecords.limitType, 'up'),
        eq(limitReasonTags.tagType, 'sector')
      )
    )
    .groupBy(limitReasonTags.sectorId)
    .orderBy(sql`count(*) desc, ${limitReasonTags.sectorId} asc`)

  // 全量重写当日快照，保证与主表一致（当日数据量在百级，成本可忽略）
  await db.delete(sectorDailyStats).where(eq(sectorDailyStats.tradeDate, tradeDate))

  let rank = 0
  for (const row of rows) {
    if (!row.sectorId) continue
    rank++
    await db.insert(sectorDailyStats).values({
      tradeDate,
      sectorId: row.sectorId,
      limitUpCount: Number(row.cnt),
      avgPct: row.avgPct == null ? null : Number(row.avgPct),
      rank
    })
  }
}

/** 重算某交易日情绪汇总 */
async function recomputeSummary(db: ReturnType<typeof useDrizzle>, tradeDate: string) {
  const agg = (await db
    .select({
      up: sql<number>`coalesce(sum(case when limit_type='up' then 1 else 0 end),0)`,
      down: sql<number>`coalesce(sum(case when limit_type='down' then 1 else 0 end),0)`,
      openCnt: sql<number>`coalesce(sum(case when limit_type='up' and open_times>0 then 1 else 0 end),0)`,
      height: sql<number>`coalesce(max(case when limit_type='up' then zt_count else 0 end),0)`,
      first: sql<number>`coalesce(sum(case when limit_type='up' and zt_count=1 then 1 else 0 end),0)`
    })
    .from(limitRecords)
    .where(eq(limitRecords.tradeDate, tradeDate)))[0]
  if (!agg) return

  const up = Number(agg.up)
  const openCnt = Number(agg.openCnt)
  const sealRate = up > 0 ? up / (up + openCnt) : 0

  await db
    .insert(marketDailySummary)
    .values({
      tradeDate,
      limitUpCount: up,
      limitDownCount: Number(agg.down),
      limitUpOpenCount: openCnt,
      ztHeight: Number(agg.height),
      firstBoardCount: Number(agg.first),
      sealRate
    })
    .onConflictDoUpdate({
      target: marketDailySummary.tradeDate,
      set: {
        limitUpCount: up,
        limitDownCount: Number(agg.down),
        limitUpOpenCount: openCnt,
        ztHeight: Number(agg.height),
        firstBoardCount: Number(agg.first),
        sealRate
      }
    })
}

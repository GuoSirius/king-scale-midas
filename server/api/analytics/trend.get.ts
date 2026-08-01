import { defineEventHandler, getQuery } from 'h3'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { marketDailySummary, marketIndexDaily } from '~~/server/db/schema'

/**
 * 涨跌停趋势时间序列（折线图）。
 * 支持按 day / month / year 聚合，可选叠加大盘指数（与大盘对比）。
 * 数据源：market_daily_summary（每日情绪汇总，含涨跌停数/连板高度/封板率等）。
 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const q = getQuery(event)
  const from = String(q.from || '')
  const to = String(q.to || '')
  const limitType = String(q.limitType || 'all') // up | down | all
  const granularity = ['day', 'month', 'year'].includes(String(q.granularity)) ? String(q.granularity) : 'day'
  const compareMarket = String(q.compareMarket || '0') === '1'
  const indexCode = String(q.index || 'sh000001')

  const bucketSql = granularity === 'month'
    ? sql`substr(${marketDailySummary.tradeDate}, 1, 7)`
    : granularity === 'year'
      ? sql`substr(${marketDailySummary.tradeDate}, 1, 4)`
      : sql`${marketDailySummary.tradeDate}`

  const conditions: SQL[] = []
  if (from) conditions.push(gte(marketDailySummary.tradeDate, from))
  if (to) conditions.push(lte(marketDailySummary.tradeDate, to))
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db
    .select({
      bucket: bucketSql,
      limitUp: sql<number>`sum(${marketDailySummary.limitUpCount})`,
      limitDown: sql<number>`sum(${marketDailySummary.limitDownCount})`,
      ztHeight: sql<number>`max(${marketDailySummary.ztHeight})`,
      firstBoard: sql<number>`sum(${marketDailySummary.firstBoardCount})`,
      sealRate: sql<number>`avg(${marketDailySummary.sealRate})`
    })
    .from(marketDailySummary)
    .where(where)
    .groupBy(bucketSql)
    .orderBy(bucketSql)

  // 与大盘对比：取指定指数在同期内的日涨跌幅序列（按相同粒度聚合）
  type MarketPoint = {
    bucket: string
    indexCode: string
    indexName: string | null
    pct: number | null
    close: number | null
  }
  let market: MarketPoint[] | null = null
  if (compareMarket) {
    const mConditions: SQL[] = [eq(marketIndexDaily.indexCode, indexCode)]
    if (from) mConditions.push(gte(marketIndexDaily.tradeDate, from))
    if (to) mConditions.push(lte(marketIndexDaily.tradeDate, to))
    const mBucket = granularity === 'month'
      ? sql`substr(${marketIndexDaily.tradeDate}, 1, 7)`
      : granularity === 'year'
        ? sql`substr(${marketIndexDaily.tradeDate}, 1, 4)`
        : sql`${marketIndexDaily.tradeDate}`
    const mRows = await db
      .select({
        bucket: mBucket,
        indexCode: marketIndexDaily.indexCode,
        indexName: marketIndexDaily.indexName,
        pct: sql<number>`avg(${marketIndexDaily.pct})`,
        close: sql<number>`max(${marketIndexDaily.close})`
      })
      .from(marketIndexDaily)
      .where(and(...mConditions))
      .groupBy(mBucket, marketIndexDaily.indexCode, marketIndexDaily.indexName)
      .orderBy(mBucket)
    market = mRows.map((r) => ({
      bucket: r.bucket,
      indexCode: r.indexCode,
      indexName: r.indexName,
      pct: r.pct == null ? null : Number(r.pct),
      close: r.close == null ? null : Number(r.close)
    }))
  }

  const series = rows.map((r) => {
    const up = Number(r.limitUp || 0)
    const down = Number(r.limitDown || 0)
    const value = limitType === 'down' ? down : limitType === 'up' ? up : up + down
    return {
      bucket: r.bucket,
      limitUp: up,
      limitDown: down,
      value,
      ztHeight: Number(r.ztHeight || 0),
      firstBoard: Number(r.firstBoard || 0),
      sealRate: r.sealRate == null ? null : Number(r.sealRate)
    }
  })

  return { granularity, limitType, series, market }
})

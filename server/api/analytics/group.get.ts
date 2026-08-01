import { defineEventHandler, getQuery } from 'h3'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { limitRecords } from '~~/server/db/schema'
import { BOARD_LABELS } from '#shared/constants/market'

/**
 * 按维度聚合计数（柱状图）。
 * dim: sector(所属板块) | industry(所属行业) | board(上市板块) | ztCount(连板数) | reason(涨停原因)
 * 可叠加 limitType(up/down/all) 与日期区间过滤。
 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const q = getQuery(event)
  const dim = ['sector', 'industry', 'board', 'ztCount', 'reason'].includes(String(q.dim)) ? String(q.dim) : 'sector'
  const limitType = String(q.limitType || 'all')
  const from = String(q.from || '')
  const to = String(q.to || '')
  const top = Math.min(Number(q.top || 20), 100)

  const labelCol = dim === 'sector'
    ? limitRecords.sector
    : dim === 'industry'
      ? limitRecords.industry
      : dim === 'board'
        ? limitRecords.board
        : dim === 'ztCount'
          ? limitRecords.ztCount
          : sql`coalesce(${limitRecords.reasonFinal}, ${limitRecords.reasonRaw})`

  const conditions: SQL[] = []
  if (limitType !== 'all') conditions.push(eq(limitRecords.limitType, limitType))
  if (from) conditions.push(gte(limitRecords.tradeDate, from))
  if (to) conditions.push(lte(limitRecords.tradeDate, to))
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db
    .select({ label: labelCol, value: sql<number>`count(*)` })
    .from(limitRecords)
    .where(where)
    .groupBy(labelCol)
    .orderBy(desc(sql`count(*)`))
    .limit(top)

  const data = rows.map((r) => ({
    label: r.label,
    text: dim === 'board' ? (BOARD_LABELS[r.label as keyof typeof BOARD_LABELS] ?? r.label) : r.label,
    value: Number(r.value || 0)
  }))

  return { dim, limitType, count: data.length, data }
})

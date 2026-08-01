import { defineEventHandler, getQuery } from 'h3'
import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { limitRecords } from '~~/db/schema'

/** 跌停列表 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const q = getQuery(event)
  const date = String(q.date || '')
  const board = String(q.board || '')
  const kw = String(q.q || '').trim()
  const limit = Math.min(Number(q.limit || 200), 500)
  const offset = Number(q.offset || 0)

  const conditions: (SQL | undefined)[] = [eq(limitRecords.limitType, 'down')]
  if (date) conditions.push(eq(limitRecords.tradeDate, date))
  if (board) conditions.push(eq(limitRecords.board, board))
  if (kw) conditions.push(or(like(limitRecords.stockName, `%${kw}%`), like(limitRecords.stockCode, `%${kw}%`)))

  const where = and(...conditions) ?? eq(limitRecords.limitType, 'down')
  const [tot] = await db.select({ c: sql<number>`count(*)` }).from(limitRecords).where(where)
  const rows = await db
    .select()
    .from(limitRecords)
    .where(where)
    .orderBy(desc(limitRecords.pct), desc(limitRecords.tradeDate))
    .limit(limit)
    .offset(offset)

  return { total: Number(tot?.c ?? 0), rows, filters: { date, board, kw } }
})

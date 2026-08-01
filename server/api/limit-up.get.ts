import { defineEventHandler, getQuery } from 'h3'
import { and, desc, eq, gte, like, or, sql } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { limitRecords } from '~~/db/schema'

/** 涨停列表（支持 日期/板块/连板数/关键词 过滤 + 分页） */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const q = getQuery(event)
  const date = String(q.date || '')
  const board = String(q.board || '')
  const minZt = Number(q.minZt || 0)
  const kw = String(q.q || '').trim()
  const limit = Math.min(Number(q.limit || 200), 500)
  const offset = Number(q.offset || 0)

  const conditions = [eq(limitRecords.limitType, 'up')]
  if (date) conditions.push(eq(limitRecords.tradeDate, date))
  if (board) conditions.push(eq(limitRecords.board, board))
  if (minZt) conditions.push(gte(limitRecords.ztCount, minZt))
  if (kw) conditions.push(or(like(limitRecords.stockName, `%${kw}%`), like(limitRecords.stockCode, `%${kw}%`)))

  const where = and(...conditions)
  const [tot] = await db.select({ c: sql<number>`count(*)` }).from(limitRecords).where(where)
  const rows = await db
    .select()
    .from(limitRecords)
    .where(where)
    .orderBy(desc(limitRecords.ztCount), desc(limitRecords.tradeDate))
    .limit(limit)
    .offset(offset)

  return { total: Number(tot.c), rows, filters: { date, board, minZt, kw } }
})

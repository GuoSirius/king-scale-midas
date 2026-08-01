import { defineEventHandler, getQuery } from 'h3'
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { limitRecords, limitRelated, dragonTiger } from '~~/server/db/schema'

/**
 * 单只票的明细 + 关系网络（用于详情页 / 关联图）。
 * 返回：该票的涨跌停记录、龙虎榜席位、以及与其他票的关联（双向：本票关联别人 + 别人关联本票）。
 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const code = String(event.context.params?.code || '').trim()
  if (!code) {
    return { code: '', records: [], related: [], dragonTiger: [] }
  }
  const q = getQuery(event)
  const date = String(q.date || '')

  const recConditions = [eq(limitRecords.stockCode, code)]
  if (date) recConditions.push(eq(limitRecords.tradeDate, date))
  const records = await db
    .select()
    .from(limitRecords)
    .where(and(...recConditions))
    .orderBy(desc(limitRecords.tradeDate))

  const related = await db
    .select()
    .from(limitRelated)
    .where(or(eq(limitRelated.stockCode, code), eq(limitRelated.relatedCode, code)))
    .orderBy(desc(limitRelated.tradeDate))

  const dtConditions = [eq(dragonTiger.stockCode, code)]
  if (date) dtConditions.push(eq(dragonTiger.tradeDate, date))
  const seats = await db
    .select()
    .from(dragonTiger)
    .where(and(...dtConditions))
    .orderBy(desc(sql`coalesce(${dragonTiger.netAmount}, 0)`))

  return {
    code,
    records,
    related,
    dragonTiger: seats
  }
})

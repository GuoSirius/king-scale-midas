import { defineEventHandler, getQuery } from 'h3'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { dragonTiger } from '~~/server/db/schema'

/**
 * 龙虎榜席位维度聚合（柱状图）：按席位汇总买入/卖出/净买额与上榜次数。
 * side: buy | sell | all（all 时买入卖出分别统计）。
 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const q = getQuery(event)
  const from = String(q.from || '')
  const to = String(q.to || '')
  const side = ['buy', 'sell', 'all'].includes(String(q.side)) ? String(q.side) : 'all'
  const top = Math.min(Number(q.top || 20), 100)

  const conditions: SQL[] = []
  if (side !== 'all') conditions.push(eq(dragonTiger.seatType, side))
  if (from) conditions.push(gte(dragonTiger.tradeDate, from))
  if (to) conditions.push(lte(dragonTiger.tradeDate, to))
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db
    .select({
      seatName: dragonTiger.seatName,
      buyAmount: sql<number>`sum(case when ${dragonTiger.seatType} = 'buy' then ${dragonTiger.buyAmount} else 0 end)`,
      sellAmount: sql<number>`sum(case when ${dragonTiger.seatType} = 'sell' then ${dragonTiger.sellAmount} else 0 end)`,
      netAmount: sql<number>`sum(${dragonTiger.netAmount})`,
      count: sql<number>`count(*)`
    })
    .from(dragonTiger)
    .where(where)
    .groupBy(dragonTiger.seatName)
    .orderBy(desc(sql`sum(${dragonTiger.netAmount})`))
    .limit(top)

  const seats = rows.map((r) => ({
    seatName: r.seatName,
    buyAmount: Number(r.buyAmount || 0),
    sellAmount: Number(r.sellAmount || 0),
    netAmount: Number(r.netAmount || 0),
    count: Number(r.count || 0)
  }))

  return { side, count: seats.length, seats }
})

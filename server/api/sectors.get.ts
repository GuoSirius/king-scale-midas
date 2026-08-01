import { defineEventHandler } from 'h3'
import { asc, desc, eq } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { marketDailySummary, sectorDailyStats } from '~~/db/schema'

/** 板块热度：取最新交易日的板块涨停分布 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const [latest] = await db
    .select({ tradeDate: marketDailySummary.tradeDate })
    .from(marketDailySummary)
    .orderBy(desc(marketDailySummary.tradeDate))
    .limit(1)
  if (!latest) return { tradeDate: null, sectors: [] }

  const sectors = await db
    .select()
    .from(sectorDailyStats)
    .where(eq(sectorDailyStats.tradeDate, latest.tradeDate))
    .orderBy(asc(sectorDailyStats.rank))
    .limit(30)

  return { tradeDate: latest.tradeDate, sectors }
})

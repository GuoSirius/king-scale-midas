import { defineEventHandler } from 'h3'
import { desc, eq, sql } from 'drizzle-orm'
import { useDrizzle } from '../../utils/db'
import { marketDailySummary, sectorDailyStats, limitRecords, limitReasonTags, concepts } from '../../db/schema'

/** 首页情绪面板数据：最新交易日汇总 + 热门板块 + 热门题材 */
export default defineEventHandler(async (event) => {
  const db = useDrizzle(event)
  const [latest] = await db
    .select()
    .from(marketDailySummary)
    .orderBy(desc(marketDailySummary.tradeDate))
    .limit(1)

  if (!latest) return { summary: null, topSectors: [], topConcepts: [] }

  const topSectors = await db
    .select()
    .from(sectorDailyStats)
    .where(eq(sectorDailyStats.tradeDate, latest.tradeDate))
    .orderBy(desc(sectorDailyStats.limitUpCount))
    .limit(8)

  // 热门题材：按当日出现次数聚合
  const topConcepts = await db
    .select({
      conceptId: limitReasonTags.conceptId,
      count: sql<number>`count(*)`,
    })
    .from(limitReasonTags)
    .innerJoin(limitRecords, eq(limitReasonTags.limitRecordId, limitRecords.id))
    .where(and(eq(limitRecords.tradeDate, latest.tradeDate), eq(limitReasonTags.tagType, 'concept')))
    .groupBy(limitReasonTags.conceptId)
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  const conceptNames = await db.select().from(concepts)
  const cMap = new Map(conceptNames.map((c) => [c.id, c.name]))
  const conceptsWithName = topConcepts
    .filter((t) => t.conceptId)
    .map((t) => ({ id: t.conceptId, name: cMap.get(t.conceptId!) || t.conceptId, count: Number(t.count) }))

  return { summary: latest, topSectors, topConcepts: conceptsWithName }
})

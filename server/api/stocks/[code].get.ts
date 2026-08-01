import { defineEventHandler, createError } from 'h3'
import { desc, eq } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { limitRecords, limitReasonTags, concepts, stocks } from '~~/db/schema'

/** 单只股票的历史涨跌停记录 + 题材标签 */
export default defineEventHandler(async (event) => {
  const code = String(event.context.params?.code || '')
  if (!code) throw createError({ statusCode: 400, statusMessage: '缺少股票代码' })

  const db = useDrizzle(event)
  const [stock] = await db.select().from(stocks).where(eq(stocks.code, code)).limit(1)
  const rows = await db
    .select()
    .from(limitRecords)
    .where(eq(limitRecords.stockCode, code))
    .orderBy(desc(limitRecords.tradeDate))

  // 关联题材名
  const conceptRows = await db.select().from(concepts)
  const cMap = new Map(conceptRows.map((c) => [c.id, c.name]))

  const history = await Promise.all(
    rows.map(async (r) => {
      const tags = await db
        .select({ conceptId: limitReasonTags.conceptId, tagType: limitReasonTags.tagType })
        .from(limitReasonTags)
        .where(eq(limitReasonTags.limitRecordId, r.id))
      return {
        ...r,
        tags: tags
          .filter((t) => t.tagType === 'concept' && t.conceptId)
          .map((t) => ({ id: t.conceptId, name: cMap.get(t.conceptId!) || t.conceptId })),
      }
    }),
  )

  return { stock: stock || null, history }
})

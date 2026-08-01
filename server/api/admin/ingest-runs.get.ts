import { defineEventHandler, desc } from 'h3'
import { useDrizzle } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'
import { ingestRuns } from '../../db/schema'

/** 采集运行监控（最近 20 次） */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDrizzle(event)
  const rows = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.runAt)).limit(20)
  return { runs: rows }
})

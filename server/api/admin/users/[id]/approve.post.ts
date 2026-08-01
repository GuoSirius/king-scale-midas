import { defineEventHandler, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { requireAdmin } from '~~/server/utils/auth'
import { users, auditLogs } from '~~/server/db/schema'

/** 审核通过用户 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = Number(event.context.params?.id)
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少用户 id' })

  const db = useDrizzle(event)
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!u) throw createError({ statusCode: 404, statusMessage: '用户不存在' })

  const now = new Date().toISOString()
  await db.update(users).set({ status: 'active', approvedBy: admin.id, approvedAt: now, updatedAt: now }).where(eq(users.id, id))
  await db.insert(auditLogs).values({ actorId: admin.id, action: 'approve_user', targetType: 'user', targetId: String(id) })

  return { ok: true }
})

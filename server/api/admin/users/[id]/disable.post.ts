import { defineEventHandler, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'
import { users, auditLogs } from '../../db/schema'

/** 禁用用户 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = Number(event.context.params?.id)
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少用户 id' })

  const db = useDrizzle(event)
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!u) throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  if (u.role === 'admin') throw createError({ statusCode: 400, statusMessage: '不能禁用管理员' })

  const now = new Date().toISOString()
  await db.update(users).set({ status: 'disabled', updatedAt: now }).where(eq(users.id, id))
  await db.insert(auditLogs).values({ actorId: admin.id, action: 'disable_user', targetType: 'user', targetId: String(id) })

  return { ok: true }
})

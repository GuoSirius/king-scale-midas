import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/auth'
import { limitRecords, userNotes } from '~~/server/db/schema'

/**
 * 补全 / 修订涨跌停原因。
 *
 * 权限分层（对应「原因抓不到时用户可自行补全」）：
 * - 管理员：写 limit_records.reason_final 并置 is_verified=1 → 全站可见，且采集器永不覆盖。
 * - 普通用户：写 user_notes.reason_override → 仅自己可见，不污染原始数据。
 *
 * 容错：普通用户误传 reason_final 时自动降级为个人补全，而不是静默失败。
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(event.context.params?.id)
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少记录 id' })

  const body = await readBody(event)
  const db = useDrizzle(event)
  const [rec] = await db.select().from(limitRecords).where(eq(limitRecords.id, id)).limit(1)
  if (!rec) throw createError({ statusCode: 404, statusMessage: '记录不存在' })

  const now = new Date().toISOString()
  const isAdmin = user.role === 'admin'
  let scope: 'global' | 'personal' | 'none' = 'none'

  // 管理员校订：写入权威字段并上锁
  if (isAdmin && body.reason_final !== undefined) {
    await db
      .update(limitRecords)
      .set({
        reasonFinal: String(body.reason_final || ''),
        isVerified: true,
        updatedAt: now
      })
      .where(eq(limitRecords.id, id))
    scope = 'global'
  }

  // 个人补全：普通用户的 reason_final 也在这里兜住
  const override =
    body.reason_override !== undefined
      ? body.reason_override
      : !isAdmin && body.reason_final !== undefined
        ? body.reason_final
        : undefined

  if (body.note !== undefined || override !== undefined) {
    await db
      .insert(userNotes)
      .values({
        limitRecordId: id,
        userId: user.id,
        note: body.note ?? null,
        reasonOverride: override ?? null,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [userNotes.limitRecordId, userNotes.userId],
        set: {
          ...(body.note !== undefined ? { note: body.note ?? null } : {}),
          ...(override !== undefined ? { reasonOverride: override ?? null } : {}),
          updatedAt: now
        }
      })
    if (scope === 'none') scope = 'personal'
  }

  if (scope === 'none') throw createError({ statusCode: 400, statusMessage: '没有可更新的字段' })

  return { ok: true, scope }
})

import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { limitRecords, userNotes } from '../../db/schema'

/**
 * 补全 / 修订涨跌停原因。
 * - 管理员：可直接写 reason_final 并置 is_verified=1（受保护，采集器不再覆盖）。
 * - 普通用户：写入 user_notes.reason_override（查看时展示，不覆盖原始数据）。
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

  if (user.role === 'admin' && body.reason_final !== undefined) {
    await db.update(limitRecords).set({
      reasonFinal: String(body.reason_final || ''),
      isVerified: true,
      updatedAt: now,
    }).where(eq(limitRecords.id, id))
  }

  if (body.note !== undefined || body.reason_override !== undefined) {
    await db.insert(userNotes).values({
      limitRecordId: id,
      userId: user.id,
      note: body.note ?? null,
      reasonOverride: body.reason_override ?? null,
      updatedAt: now,
    })
  }

  return { ok: true }
})

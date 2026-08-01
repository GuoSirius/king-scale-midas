import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~~/server/utils/db'
import { verifyPassword } from '~~/server/utils/crypto'
import { createSession } from '~~/server/utils/session'
import { users, type User } from '~~/db/schema'

function publicUser(u: User) {
  return { id: u.id, email: u.email, username: u.username, status: u.status, role: u.role }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) throw createError({ statusCode: 400, statusMessage: '邮箱/密码必填' })

  const db = useDrizzle(event)
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) throw createError({ statusCode: 401, statusMessage: '邮箱或密码错误' })

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw createError({ statusCode: 401, statusMessage: '邮箱或密码错误' })

  if (user.status === 'pending') throw createError({ statusCode: 403, statusMessage: '账号待管理员审核，暂无法登录' })
  if (user.status === 'disabled') throw createError({ statusCode: 403, statusMessage: '账号已被禁用' })

  await createSession(event, user.id)
  await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id))
  return { ok: true, user: publicUser(user) }
})

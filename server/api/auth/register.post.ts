import { defineEventHandler, readBody, createError } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { useDrizzle } from '../../utils/db'
import { hashPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'
import { users, type User } from '../../db/schema'

function publicUser(u: User) {
  return { id: u.id, email: u.email, username: u.username, status: u.status, role: u.role }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body.email || '').trim().toLowerCase()
  const username = String(body.username || '').trim()
  const password = String(body.password || '')

  if (!email || !username || !password)
    throw createError({ statusCode: 400, statusMessage: '邮箱、用户名、密码均必填' })
  if (password.length < 8)
    throw createError({ statusCode: 400, statusMessage: '密码至少 8 位' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: '邮箱格式不正确' })

  const db = useDrizzle(event)

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw createError({ statusCode: 409, statusMessage: '该邮箱已注册' })

  const passwordHash = await hashPassword(password)

  // 首用户自举为管理员（仅当库为空时），否则为待审核普通用户
  const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(users)
  const isFirst = Number(c) === 0

  const [user] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash,
      status: isFirst ? 'active' : 'pending',
      role: isFirst ? 'admin' : 'user',
      approvedBy: isFirst ? null : null,
      approvedAt: isFirst ? new Date().toISOString() : null,
    })
    .returning()

  if (isFirst) {
    await createSession(event, user.id)
    return { ok: true, bootstrapAdmin: true, user: publicUser(user) }
  }

  return { ok: true, bootstrapAdmin: false, user: publicUser(user), message: '注册成功，请等待管理员审核通过后登录' }
})

import { getCookie, setCookie, deleteCookie, getRequestHeader, type H3Event } from 'h3'
import { and, eq, gt } from 'drizzle-orm'
import { useDrizzle } from './db'
import { sha256Hex, randomToken } from './crypto'
import { sessions, users, type User } from '~~/db/schema'

const COOKIE = 'ksm_session'
const TTL_DAYS = 7
const MAX_AGE = TTL_DAYS * 86400

/** 创建会话：生成随机 token → 存 D1（仅存哈希）→ 写 httpOnly cookie */
export async function createSession(event: H3Event, userId: number) {
  const token = randomToken(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400_000).toISOString()
  const db = useDrizzle(event)
  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    ip: getRequestHeader(event, 'x-forwarded-for') || null,
    userAgent: getRequestHeader(event, 'user-agent') || null,
  })
  setCookie(event, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

/** 从事件解析当前登录用户（无效/过期/未审核通过均返回 null） */
export async function getUserFromEvent(event: H3Event): Promise<User | null> {
  const token = getCookie(event, COOKIE)
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const db = useDrizzle(event)
  const [sess] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date().toISOString())))
  if (!sess) return null
  const [user] = await db.select().from(users).where(eq(users.id, sess.userId))
  if (!user || user.status !== 'active') return null
  return user
}

/** 销毁会话（登出） */
export async function destroySession(event: H3Event) {
  const token = getCookie(event, COOKIE)
  if (token) {
    const tokenHash = await sha256Hex(token)
    const db = useDrizzle(event)
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }
  deleteCookie(event, COOKIE, { path: '/' })
}

import { createError, type H3Event } from 'h3'
import { getUserFromEvent } from './session'
import type { User } from '~~/server/db/schema'

/** 要求已登录且已审核通过，否则 401 */
export async function requireUser(event: H3Event): Promise<User> {
  const user = await getUserFromEvent(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录或会话已失效' })
  return user
}

/** 要求管理员，否则 403 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw createError({ statusCode: 403, statusMessage: '需要管理员权限' })
  return user
}

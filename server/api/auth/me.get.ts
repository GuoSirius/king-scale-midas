import { defineEventHandler } from 'h3'
import { getUserFromEvent } from '~~/server/utils/session'
import type { User } from '~~/db/schema'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  if (!user) return { user: null }
  const safe: Pick<User, 'id' | 'email' | 'username' | 'status' | 'role'> = {
    id: user.id,
    email: user.email,
    username: user.username,
    status: user.status,
    role: user.role,
  }
  return { user: safe }
})

import { defineEventHandler, desc } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'
import { users, type User } from '../../db/schema'

function publicUser(u: User) {
  return {
    id: u.id, email: u.email, username: u.username, status: u.status, role: u.role,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
  }
}

/** 待审核用户列表 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDrizzle(event)
  const rows = await db.select().from(users).where(eq(users.status, 'pending')).orderBy(desc(users.createdAt))
  return { users: rows.map(publicUser), count: rows.length }
})

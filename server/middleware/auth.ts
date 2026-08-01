import { defineEventHandler } from 'h3'
import { requireAdmin } from '../utils/auth'

/**
 * 全局鉴权中间件：所有 /api/admin/** 必须由管理员访问。
 * 路由内部仍调用 requireUser/requireAdmin 以保证类型安全（幂等）。
 */
export default defineEventHandler(async (event) => {
  const path = (event.path || event.node?.req?.url || '')
  if (path.startsWith('/api/admin')) {
    await requireAdmin(event) // 未登录/非管理员 → 抛 401/403
  }
})

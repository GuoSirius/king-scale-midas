import { defineEventHandler } from 'h3'
import { requireUser } from '~~/server/utils/auth'
import { PUBLIC_API_PREFIXES } from '#shared/constants/market'

/**
 * 全站 API 鉴权：除登录态自身与机器投递接口外，所有 /api/* 都要求已登录。
 * 路由内部仍按需调用 requireUser/requireAdmin 做细粒度校验（幂等）。
 */
export default defineEventHandler(async (event) => {
  const path = (event.path || event.node?.req?.url || '').split('?')[0]
  if (!path.startsWith('/api/')) return
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  await requireUser(event)
})

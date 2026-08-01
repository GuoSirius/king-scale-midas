import { drizzle } from 'drizzle-orm/d1'
import { schema } from '../../db/schema'
import { createError, type H3Event } from 'h3'

/**
 * 获取 D1 的 Drizzle 实例。
 * 在 Cloudflare Workers / @cloudflare/nuxt 本地 dev（miniflare）下，
 * D1 绑定位于 event.context.cloudflare.env.DB。
 */
export function useDrizzle(event: H3Event) {
  const env = (event.context as any)?.cloudflare?.env
  const binding = env?.DB
  if (!binding) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'D1 binding "DB" not found. Run via `npm run dev` (miniflare) or deploy to Cloudflare Workers.',
    })
  }
  return drizzle(binding, { schema })
}

export type DB = ReturnType<typeof useDrizzle>

// 全局会话：插件中加载一次，页面与中间件共享同一份响应式状态，避免重复请求与未登录闪屏
import type { SessionUser } from '#shared/types/api'

const useUserState = () => useState<SessionUser | null>('ksm-user', () => null)
const useLoadedState = () => useState<boolean>('ksm-session-loaded', () => false)

export const useSession = () => {
  const user = useUserState()
  const loaded = useLoadedState()

  async function load() {
    if (loaded.value) return
    try {
      // SSR 阶段：内部 $fetch 不会自动带上入站 cookie，需手动透传，
      // 否则服务端渲染受保护页面时 /api/auth/me 读不到会话 → 被中间件弹回 /login。
      const headers: Record<string, string> = {}
      if (import.meta.server) {
        const cookie = useRequestHeaders(['cookie']).cookie
        if (cookie) headers.cookie = cookie
      }
      const res = await $fetch<{ user: SessionUser | null }>('/api/auth/me', { headers })
      user.value = res.user
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    loaded.value = true
    await navigateTo('/login')
  }

  return { user, loaded, load, logout }
}

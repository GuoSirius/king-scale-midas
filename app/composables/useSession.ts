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
      const res = await $fetch<{ user: SessionUser | null }>('/api/auth/me')
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

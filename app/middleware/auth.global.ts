import { PUBLIC_ROUTES } from '#shared/constants/market'

// 全站页面鉴权：未登录访问受保护页面时重定向到 /login（带 redirect 回跳参数）
export default defineNuxtRouteMiddleware((to) => {
  if ((PUBLIC_ROUTES as readonly string[]).includes(to.path)) return
  const { user, loaded } = useSession()
  if (!loaded.value || !user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})

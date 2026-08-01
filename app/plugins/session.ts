// 应用启动时预拉取一次会话，使全站鉴权中间件在 SSR 阶段即可判断登录态
export default defineNuxtPlugin(async () => {
  const { load } = useSession()
  await load()
})

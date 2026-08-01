/**
 * Nitro 插件：本地开发时把 D1 绑定注入 event.context.cloudflare.env.DB。
 *
 * 只在 `npm run dev:local` / LOCAL_D1=1 时被 nuxt.config 显式注册，
 * 因此 Cloudflare 生产构建完全不会打包到它，也就不会把 node:sqlite 带进 Workers。
 *
 * shim 用「运行时绝对路径 + @vite-ignore」动态引入，
 * 避免 Rollup 在打包阶段把 node:sqlite 静态分析进依赖图。
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export default defineNitroPlugin(async (nitroApp) => {
  const dbPath = process.env.LOCAL_D1_PATH || resolve(process.cwd(), '.data/local.db')
  const shimUrl = pathToFileURL(resolve(process.cwd(), 'server/local/d1-shim.mjs')).href

  const { openLocalD1 } = await import(/* @vite-ignore */ shimUrl)
  const DB = await openLocalD1(dbPath)

  console.log(`[local-d1] 已挂载本地 D1（node:sqlite）→ ${dbPath}`)

  nitroApp.hooks.hook('request', (event: any) => {
    event.context.cloudflare = event.context.cloudflare || {}
    event.context.cloudflare.env = { ...(event.context.cloudflare.env || {}), DB }
  })
})

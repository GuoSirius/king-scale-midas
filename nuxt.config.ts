import { defineNuxtConfig } from 'nuxt/config'

// 金鳞·点石 — A股每日涨跌停复盘系统
// 技术栈：Nuxt 4 (SSR) + Vue 3 + UnoCSS + Cloudflare D1(Drizzle) + PWA
//
// 双运行模式（对应「B主 + A备」）：
//   B 主 —— 默认。nitro-cloudflare-dev + workerd/miniflare，构建产物为 Workers，连真 D1。
//   A 备 —— `npm run dev:local`。纯 Node 跑，D1 由 local/d1-shim.mjs 用 node:sqlite 模拟，
//           不需要 wrangler、不需要联网下载 workerd，拉下代码即可本机跑通。
const LOCAL_MODE =
  process.env.LOCAL_D1 === '1' ||
  ['dev:local', 'build:local'].includes(process.env.npm_lifecycle_event || '')

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  // ── 模块（全部最新） ──────────────────────────────
  modules: [
    // 本地 A 备模式下不加载 cloudflare-dev，否则会去拉 workerd 二进制
    ...(LOCAL_MODE ? [] : ['nitro-cloudflare-dev']), // Cloudflare 本地 D1/KV 仿真 + Workers 构建
    '@unocss/nuxt',         // UnoCSS 原子化 CSS
    '@vite-pwa/nuxt',       // PWA：离线缓存 + 可安装
    '@nuxt/eslint'          // 开发期 ESLint 校验 + 生成为自动导入 globals
  ],

  // ── 渲染模式：当前 SSR；CSR / SSG / ISR 已预留 ──────
  ssr: true,
  // 后期演进开关（示例，按需取消注释）：
  routeRules: {
    // ISR（增量静态再生）：列表类高频页可开启，命中缓存秒级回源
    // '/limit-up': { isr: 60 },
    // '/limit-down': { isr: 60 },
    // SSG（纯静态预渲染）：营销/文档页
    // '/about': { prerender: true },
    // CSR（客户端渲染）：重交互后台页
    // '/admin/**': { ssr: false },
  },

  css: ['~/assets/css/main.css'],

  // ── 服务端环境变量（通过 NUXT_INGEST_SECRET / NUXT_SESSION_SECRET 注入） ──
  runtimeConfig: {
    ingestSecret: '',   // /api/ingest 的 HMAC 签名密钥
    sessionSecret: ''  // 会话 cookie 签名密钥
  },

  // ── PWA ───────────────────────────────────────────
  pwa: {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    manifest: {
      name: '金鳞·点石',
      short_name: '金鳞',
      description: 'A股每日涨跌停复盘与题材追踪',
      lang: 'zh-CN',
      theme_color: '#0b0b0f',
      background_color: '#0b0b0f',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
      navigateFallback: '/'
    },
    devOptions: { enabled: false }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      // 首屏前根据 localStorage 设定主题，避免闪烁
      script: [
        {
          innerHTML:
            "(function(){try{var t=localStorage.getItem('theme')||'dark';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t==='system'&&m);document.documentElement.classList.toggle('light',!d);}catch(e){}})();",
          tagPosition: 'head'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48 128x128' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0b0b0f' },
        { name: 'description', content: 'A股每日涨跌停复盘与题材追踪' },
        { property: 'og:title', content: '金鳞·点石' },
        { property: 'og:description', content: 'A股每日涨跌停复盘与题材追踪' },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:type', content: 'website' }
      ]
    }
  },

  // 构建产物：Cloudflare Workers（免费），D1 绑定由 wrangler.toml 提供
  nitro: LOCAL_MODE
    ? {
      preset: 'node-server',
      // 只在本地模式注册，Cloudflare 构建完全不会打包 node:sqlite
      plugins: ['~~/local/nitro-local-d1.ts']
    }
    : {
      preset: 'cloudflare_module',
      cloudflare: {
        deployConfig: false
      }
    }
})

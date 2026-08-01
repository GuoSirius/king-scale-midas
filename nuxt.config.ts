import { defineNuxtConfig } from 'nuxt/config'

// 金鳞·点石 — A股每日涨跌停复盘系统
// 技术栈：Nuxt 4 (SSR) + Vue 3 + UnoCSS + Cloudflare D1(Drizzle) + PWA
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  // ── 模块（全部最新） ──────────────────────────────
  modules: [
    'nitro-cloudflare-dev', // Cloudflare 本地 D1/KV 仿真 + Workers 构建（国内镜像可用）
    '@unocss/nuxt',         // UnoCSS 原子化 CSS
    '@vite-pwa/nuxt',       // PWA：离线缓存 + 可安装
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
    sessionSecret: '',  // 会话 cookie 签名密钥
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
        { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
      navigateFallback: '/',
    },
    devOptions: { enabled: false },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      // 首屏前根据 localStorage 设定主题，避免闪烁
      script: [
        {
          innerHTML:
            "(function(){try{var t=localStorage.getItem('theme')||'dark';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t==='system'&&m);document.documentElement.classList.toggle('light',!d);}catch(e){}})();",
          tagPosition: 'head',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-192.svg' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0b0b0f' },
      ],
    },
  },

  // 构建产物：Cloudflare Workers（免费），D1 绑定由 wrangler.toml 提供
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: false,
    },
  },
})

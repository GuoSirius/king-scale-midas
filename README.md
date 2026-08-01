# 金鳞 · 点石 (King Scale · Midas)

A股每日盘后涨跌停复盘与题材追踪系统。

> 「金鳞岂是池中物，一遇风云便化龙」——记录每一条涨停，看首板如何长成龙头；
> 「点石成金」——把零散的盘后数据，沉淀为可检索、可复盘、可验证的资产。

## 技术栈
- **Nuxt 4**（SSR，预留 CSR / SSG / ISR）
- **Vue 3** + **UnoCSS**
- **Cloudflare Workers** + **D1**（Drizzle ORM）
- **PWA**（可安装 / 离线）
- **Python 采集器**（GitHub Actions 为主，本地可跑为备）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env   # 填入 INGEST_SECRET / SESSION_SECRET

# 3. 本地开发（无需 Cloudflare / workerd，D1 由 node:sqlite 模拟）
npm run dev:local

# 4.（可选）灌入演示数据，验证全链路
npm run db:seed:demo

# 5.（可选）本地跑一次采集
npm run collect:local:today
```

> 国内网络直接 `npm run dev` 可能因下载 workerd 二进制而卡住，
> 建议始终使用 `npm run dev:local`。

## 目录结构
```
db/schema.ts        Drizzle 表结构（24 表 / 5 域）
server/             服务端 API + 中间件 + 工具
components/         业务组件
pages/              页面（SSR）
collector/          Python 采集器（B主+A备）
public/             favicon / PWA 图标（含 ico / png / svg）
local/              本地 D1 兼容层（node:sqlite）
scripts/            本地数据库 / 演示数据 / 图标生成脚本
docs/DEPLOY.md      完整部署指南
```

## 部署

详见 [docs/DEPLOY.md](./docs/DEPLOY.md)。简版：

1. `npx wrangler d1 create king-scale-midas-db` 并把 id 填入 `wrangler.toml`
2. `npm run db:migrate:remote`
3. `npm run build` → `npx wrangler deploy .output/server/index.mjs --assets .output/public`
4. 在 Cloudflare / GitHub Secrets 配置 `INGEST_SECRET`、`INGEST_URL`，开启 Actions 定时采集

## 核心设计

- **双运行模式**：`npm run dev:local`（A 备 / 纯 Node）与 Cloudflare Workers（B 主 / 在线）共享同一套代码。
- **采集幂等**：`UNIQUE(trade_date, stock_code, limit_type)`，可重复投递不脏数据。
- **人肉优先**：`is_verified=1` 的记录不会被采集器覆盖。
- **派生表提速**：`market_daily_summary` / `sector_daily_stats` 避免首页实时 GROUP BY。
- **注册审核**：首个用户自举为管理员，后续用户需审核通过才能登录。

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
# 1. 安装依赖（已切国内镜像）
npm install

# 2. 配置环境变量
cp .env.example .env   # 填入 INGEST_SECRET / SESSION_SECRET / D1 信息

# 3. 本地数据库迁移
npm run db:migrate:local

# 4. 启动
npm run dev

# 5.（可选）本地跑一次采集
npm run collect:local:today
```

## 目录结构
```
db/schema.ts        Drizzle 表结构（24 表 / 5 域）
server/             服务端 API + 中间件 + 工具
components/         业务组件
pages/              页面（SSR）
collector/          Python 采集器（B主+A备）
public/             favicon / PWA 图标
```

## 部署
1. `wrangler d1 create king-scale-midas-db` 并把 id 填入 `wrangler.toml`
2. `npm run db:migrate:remote`
3. `npm run build` → 部署到 Cloudflare Workers（免费版）
4. 在 GitHub 仓库 Secrets 配置 `INGEST_SECRET`、`INGEST_URL`，开启 Actions 定时采集

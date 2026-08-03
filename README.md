# 金鳞 · 点石 (King Scale · Midas)

A股每日盘后涨跌停复盘与题材追踪系统。

> 「金鳞岂是池中物，一遇风云便化龙」——记录每一条涨停，看首板如何长成龙头；
> 「点石成金」——把零散的盘后数据，沉淀为可检索、可复盘、可验证的资产。

## 品牌释义

系统取名「金鳞·点石」，取自两句典故，也划定了产品的边界：

- **金鳞** —— 「金鳞岂是池中物，一遇风云便化龙」。涨停板正是个股脱离震荡区间的那一跃；
  我们要做的，是在满池游鱼里认出那几片会发光的鳞。
- **点石** —— 「点石成金」。公开行情本身是散落的石头，唯有被清洗、归因、串成题材脉络，
  才会沉淀为能复盘、能验证的判断依据。

**产品宗旨**：不预测涨跌，只把当天发生过的事讲清楚。
（数据来自公开接口，仅供研究学习，不构成任何投资建议。）

## 技术栈

- **Nuxt 4**（SSR，预留 CSR / SSG / ISR）
- **Vue 3** + **UnoCSS**（FontAwesome 6 图标，纯 CSS 零运行时）
- **Cloudflare Workers** + **D1**（Drizzle ORM）
- **PWA**（可安装 / 离线）
- **Python 采集器**（GitHub Actions 为主，本地可跑为备）
- **ESLint** + **@stylistic**（开发 / 构建期强制代码规范，见 [docs/guide/代码规范.md](./docs/guide/代码规范.md)）

## 目录结构

```
app/          Nuxt 前端：pages / components / composables / layouts / middleware / plugins / assets
server/       Nitro 后端：api / middleware / utils / db（Drizzle 表结构 + 迁移）/ local（D1 兼容层）
shared/       前后端共用：constants（品牌 / 市场枚举 / 鉴权白名单）、types、utils（#shared 别名）
collector/    Python 采集器（B主 GitHub Actions + A备 本地）
public/       favicon / PWA 图标（ico / png / svg）
scripts/      本地数据库 / 演示数据 / 图标生成脚本
docs/         项目文档：deploy（部署）/ guide（规范）/ planning（规划）
```

## 快速开始

```bash
# 1. 安装依赖（postinstall 会自动执行 nuxt prepare，生成类型与 ESLint 自动导入 globals）
npm install

# 2. 配置环境变量（.env 不会自动生成，必须手动复制后改值）
cp .env.example .env
#   至少改两项，且值相同：
#     NUXT_INGEST_SECRET  ← Nuxt 服务端读取（必须 NUXT_ 前缀）
#     INGEST_SECRET       ← Python 采集器读取（无前缀）

# 3. 本地开发（无需 Cloudflare / workerd，D1 由 node:sqlite 模拟）
npm run dev:local

# 4.（可选）灌入演示数据，验证全链路
npm run db:seed:demo

# 5.（可选）本地跑一次采集
npm run collect:local:today
```

> 国内网络直接 `npm run dev` 可能因下载 workerd 二进制而卡住，建议始终使用 `npm run dev:local`。

常用脚本：`npm run lint`（代码规范校验）、`npm run typecheck`（类型检查）、`npm run build`（构建，会先跑 lint）。

## 部署

目标：零成本上线（Cloudflare 免费版 + GitHub Actions 免费 runner）。
架构：Nuxt 4 SSR → Cloudflare Workers；D1 SQLite 存数据；GitHub Actions 盘后自动采集。

> **完整、可照做的部署步骤（含环境变量命名、密钥设置、部署后验证）统一维护在
> [docs/deploy/cloudflare-github.md](./docs/deploy/cloudflare-github.md)。**
> 本文档只给概览，避免与详细文档漂移。

快速部署清单（细节见上方文档）：

1. **前置**：Node.js ≥ 24、GitHub 账号、Cloudflare 账号（免费）。
2. **本地先跑通（A 备）**：`npm install` → `cp .env.example .env`（设 `NUXT_INGEST_SECRET` 与 `INGEST_SECRET` 同值）→ `npm run dev:local` → 可选 `npm run db:seed:demo`。
3. **建 D1**：`npx wrangler d1 create king-scale-midas-db`，把 `database_id` 填入 `wrangler.toml`。
4. **迁移**：`npm run db:migrate:remote`。
5. **设密钥（关键）**：Cloudflare 变量名必须是 **`NUXT_INGEST_SECRET` / `NUXT_SESSION_SECRET`**（带 `NUXT_` 前缀，不是 `INGEST_SECRET`）；或 `npx wrangler secret put NUXT_INGEST_SECRET`。
6. **构建部署**：`npm run build` → `npx wrangler deploy`，得到 `*.workers.dev` 域名。
7. **验证**：用错误签名 `curl` 打 `/api/ingest` 应返回 **401**（返回 500「未配置」= 密钥命名错）。
8. **自动采集**：GitHub 仓库 Secrets 加 `INGEST_URL` / `INGEST_SECRET`（值与第 5 步相同），`collect.yml` 工作日约 15:30（北京时间）自动跑。
9. **首个用户**：注册即管理员；后续用户需 `/admin` 审核。

> 国内网络直接 `npm run dev` 可能因下载 workerd 二进制卡住，本地开发始终用 `npm run dev:local`。

## 核心设计

- **双运行模式**：`npm run dev:local`（A 备 / 纯 Node）与 Cloudflare Workers（B 主 / 在线）共享同一套代码。
- **全站鉴权**：前后台页面均经 `app/middleware/auth.global.ts` 守卫（白名单 `/login`、`/register`）；
  所有 `/api/*` 均经 `server/middleware/auth.ts` 校验登录态（登录态自身与机器投递接口除外）。
- **采集幂等**：`UNIQUE(trade_date, stock_code, limit_type)`，可重复投递不脏数据。
- **人肉优先**：`is_verified=1` 的记录不会被采集器覆盖。
- **派生表提速**：`market_daily_summary` / `sector_daily_stats` 避免首页实时 GROUP BY。
- **注册审核**：首个用户自举为管理员，后续用户需审核通过才能登录。

## 代码规范

开发 / 构建期由 ESLint 强制校验：未使用变量与导入报错、未定义变量 / 引用报错、
HTML 标签必须闭合、Vue 属性顺序与 kebab-case、无分号、两空格缩进、
文件末尾一行空行、空行最多一个、对象 / 数组末无逗号。
详见 [docs/guide/代码规范.md](./docs/guide/代码规范.md)。

## 免责声明

数据来自公开接口，仅供研究学习，不构成任何投资建议。

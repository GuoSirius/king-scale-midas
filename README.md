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

# 2. 配置环境变量
cp .env.example .env   # 填入 INGEST_SECRET / SESSION_SECRET

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

### 1. 前置准备

- Node.js ≥ 24（推荐 24 LTS / 26）
- 一个 GitHub 账号
- 一个 Cloudflare 账号（免费即可）
- 安装 wrangler（可选）：`npm i -g wrangler` 或 `npx wrangler`

### 2. 拉代码 & 安装依赖

```bash
git clone https://github.com/GuoSirius/king-scale-midas.git
cd king-scale-midas
npm install
```

### 3. 本地运行（A 备模式，无需 Cloudflare / workerd）

```bash
npm run dev:local
```

首次运行会生成 `.data/local.db` 和 `.env`（若不存在）。

### 4. 创建 Cloudflare D1 数据库

```bash
npx wrangler d1 create king-scale-midas-db
```

记录返回的 `database_id`，填入 `wrangler.toml` 的 `[[d1_databases]]`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "king-scale-midas-db"
database_id = "<你的 database_id>"
```

> `wrangler.toml` 已配置 `main`、静态资源 `assets` 绑定与 `migrations_dir`，无需手动补。

### 5. 应用数据库迁移

```bash
npm run db:migrate:remote   # 应用到远程 D1
npm run db:migrate:local    # 或本地 wrangler dev 环境
```

### 6. 设置密钥并部署到 Cloudflare Workers

在 Cloudflare Dashboard → Workers & Pages → king-scale-midas → Settings → Variables 中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `INGEST_SECRET` | 采集器 HMAC 签名密钥 | 随机 32+ 字符 |
| `SESSION_SECRET` | 会话 cookie 签名密钥 | 随机 32+ 字符 |

> Nuxt runtimeConfig 读取的是 `NUXT_INGEST_SECRET` / `NUXT_SESSION_SECRET`，
> 在 Wrangler 变量里直接配 `INGEST_SECRET` / `SESSION_SECRET` 即可生效。

构建并部署：

```bash
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public
```

部署成功后输出 Workers URL，例如 `https://king-scale-midas.<子域>.workers.dev`。

### 7. 配置 GitHub Actions 自动采集（B 主，盘后触发）

采集接口为 `POST https://<你的 Workers 域名>/api/ingest`。

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 添加：

| Secret | 值 |
|--------|-----|
| `INGEST_URL` | `https://<你的 Workers 域名>/api/ingest` |
| `INGEST_SECRET` | 与 Cloudflare 中一致的 HMAC 密钥 |

仓库已有 `.github/workflows/collect.yml`，默认在 A 股收盘后（工作日 15:35 北京时间）自动运行。
手动触发：`gh workflow run collect.yml`（或在 GitHub → Actions → Run workflow）。

### 8. 本地采集作为备份（A 备）

```bash
export INGEST_URL=https://<你的 Workers 域名>/api/ingest
export INGEST_SECRET=<你的密钥>
python collector/run.py --date today
```

采集器用 HMAC-SHA256 签名后 POST 到 Workers。

### 9. 首个用户注册与审核

1. 打开站点注册，填写邮箱 / 用户名 / 密码。
2. **第一个注册用户自动成为管理员**（库为空时自举）。
3. 后续新用户注册后状态为 `pending`，需管理员在 `/admin` 审核通过才能登录。

### 10. 更新（代码变更后重新部署）

```bash
git pull
npm install
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public
```

数据库结构若变更，先 `npm run db:generate` 生成迁移，再 `npm run db:migrate:remote` 应用，最后重新部署。

更完整的部署说明见 [docs/deploy/cloudflare-github.md](./docs/deploy/cloudflare-github.md)。

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

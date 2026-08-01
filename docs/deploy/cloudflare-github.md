# 金鳞·点石 部署指南

> 目标：零成本上线（Cloudflare 免费版 + GitHub Actions 免费 runner）。
> 架构：Nuxt 4 SSR → Cloudflare Workers；D1 SQLite 存数据；GitHub Actions 盘后采集。

---

## 1. 前置准备

- Node.js ≥ 24（推荐 24 LTS / 26）
- 一个 GitHub 账号
- 一个 Cloudflare 账号（免费即可）
- 安装 wrangler CLI（可选，但推荐）：`npm i -g wrangler` 或 `npx wrangler`

## 2. 拉代码 & 安装依赖

```bash
git clone https://github.com/GuoSirius/king-scale-midas.git
cd king-scale-midas
npm install
```

## 3. 本地运行（A 备模式，无需 Cloudflare / workerd）

本机直接跑，D1 用 `node:sqlite` 模拟，适合开发调试和离线使用。

```bash
# 自动建本地库、跑迁移、启动 dev server
npm run dev:local
```

首次运行会生成 `.data/local.db` 和 `.env`（若不存在）。

### 常用本地脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev:local` | 本地开发（带 D1 shim） |
| `npm run build:local` | 本地生产构建 |
| `npm run preview:local` | 预览本地构建产物 |
| `npm run db:local:reset` | 重置本地数据库 |
| `npm run db:seed:demo` | 灌入 21 条演示数据，同时验证 HMAC 签名链路 |
| `npm run collect:local` | 运行 Python 采集器（需配置 akshare/pywencai） |

## 4. 创建 Cloudflare D1 数据库

```bash
npx wrangler d1 create king-scale-midas-db
```

记录返回的 `database_id`，填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "king-scale-midas-db"
database_id = "<你的 database_id>"
```

## 5. 应用数据库迁移

```bash
# 应用到远程 D1
npm run db:migrate:remote

# 或本地 wrangler dev 环境
npm run db:migrate:local
```

## 6. 部署到 Cloudflare Workers

### 6.1 设置密钥

在 Cloudflare Dashboard → Workers & Pages → king-scale-midas → Settings → Variables 中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `INGEST_SECRET` | 采集器 HMAC 签名密钥 | 随机 32+ 字符 |
| `SESSION_SECRET` | 会话 cookie 签名密钥 | 随机 32+ 字符 |

> 注意：Nuxt runtimeConfig 读取的是 `NUXT_INGEST_SECRET` / `NUXT_SESSION_SECRET`，
> 但 Wrangler 里直接配 `INGEST_SECRET` / `SESSION_SECRET` 即可，
> 具体以 `nuxt.config.ts` 中 `runtimeConfig` 的命名为准。

### 6.2 构建并部署

```bash
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public
```

部署成功后，wrangler 会输出 Workers URL，例如：
`https://king-scale-midas.<你的子域>.workers.dev`

## 7. 配置 GitHub Actions 自动采集（B 主）

### 7.1 获取采集入口 URL

部署成功后，采集接口为：

```
POST https://<你的 Workers 域名>/api/ingest
```

### 7.2 在 GitHub 仓库设置 Secrets

进入仓库 Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|--------|-----|
| `INGEST_URL` | `https://<你的 Workers 域名>/api/ingest` |
| `INGEST_SECRET` | 与 Cloudflare 中一致的 HMAC 密钥 |

### 7.3 启用工作流

仓库已有 `.github/workflows/collect.yml`，默认在 A 股收盘后（工作日 15:35 北京时间）自动运行。

如需立即手动触发：

```bash
gh workflow run collect.yml
# 或在 GitHub 仓库 → Actions → Collect Limit Data → Run workflow
```

## 8. 本地采集作为备份（A 备）

如果 GitHub Actions 因网络或源站问题失败，可在本机执行：

```bash
# 配置采集入口
export INGEST_URL=https://<你的 Workers 域名>/api/ingest
export INGEST_SECRET=<你的密钥>

# 采集今日数据
python collector/run.py --date today
```

采集器会用 HMAC-SHA256 签名后 POST 到 Workers。

## 9. 首个用户注册与审核

1. 打开站点，点击注册，填写邮箱/用户名/密码。
2. **第一个注册用户会自动成为管理员**（库为空时自举）。
3. 后续新用户注册后状态为 `pending`，需管理员在 `/admin` 页面审核通过才能登录。

## 10. 常见问题

### Q: `nuxt dev` 在本机卡住 / workerd 下载失败？
A: 国内网络访问 GitHub 下载 workerd 二进制常被墙。直接使用 `npm run dev:local`，
   无需 workerd，也不依赖 Cloudflare。

### Q: 采集到的涨停原因为空？
A: 数据源不保证 100% 提供原因。系统会尽量抓取；用户可在个股详情页手动补全
   （普通用户仅自己可见，管理员审核后可设为全局）。

### Q: 构建产物过大？
A: 当前产物约 760 kB / 260 kB gzip，在 Cloudflare 免费版限制内。

---

部署完成后，记得把 Workers URL 和 D1 信息同步到团队文档。

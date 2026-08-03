# 金鳞·点石 部署指南（权威文档）

> 目标：零成本上线（Cloudflare 免费版 + GitHub Actions 免费 runner）。
> 架构：Nuxt 4 SSR → Cloudflare Workers；D1 SQLite 存数据；GitHub Actions 盘后自动采集。
> 本文档是部署的**唯一权威来源**，README 的「部署」章节只做概览并指向本文件，避免两处内容漂移。

---

## 0. 流程总览

```
[本地 A 备]  npm run dev:local  ──►  本机跑通全链路（node:sqlite 模拟 D1，无需 Cloudflare）
        │
        │  验证 OK 后上云
        ▼
[在线 B 主]  ① 创建 D1 数据库 → ② 填 database_id → ③ 应用迁移
          → ④ 设 NUXT_INGEST_SECRET / NUXT_SESSION_SECRET → ⑤ build + wrangler deploy
          → ⑥ 部署后验证 /api/ingest → ⑦ 配 GitHub Actions Secrets → ⑧ 首个用户=管理员
```

部署后日常：代码变更 → `git pull` → `npm install` → `npm run build` → `npx wrangler deploy`（见第 9 节）。

---

## 1. 环境变量速查表（务必先看）

本项目有三套"环境"，变量**命名规则不同但语义相同**，配错名字会导致 401/500。

| 场景 | 变量名 | 被谁读取 | 命名规则 / 易错点 |
|------|--------|----------|-------------------|
| **本地 `.env`** — Nuxt 服务端 | `NUXT_INGEST_SECRET` | `server/api/ingest.post.ts`（经 `useRuntimeConfig`） | **必须 `NUXT_` 前缀** |
| **本地 `.env`** — Python 采集器 | `INGEST_SECRET` / `INGEST_URL` | `collector/run.py`（`os.environ`） | 无前缀 |
| **Cloudflare** — Dashboard / `wrangler secret` | `NUXT_INGEST_SECRET` / `NUXT_SESSION_SECRET` | 同上（Nuxt runtimeConfig） | **必须 `NUXT_` 前缀！不要写成 `INGEST_SECRET`** |
| **GitHub Actions** — Repository Secret | `INGEST_SECRET` / `INGEST_URL` | `collect.yml` → 注入环境变量 → `collector/run.py` | 无前缀 |

**三条铁律：**

1. **HMAC 密钥只有一个值**：`NUXT_INGEST_SECRET`（Cloudflare / 本地服务端）、`INGEST_SECRET`（采集器 / Actions）这两者**值必须完全相同**，否则签名校验 401。
2. **服务端侧一律带 `NUXT_` 前缀**：`nuxt.config.ts` 用 `runtimeConfig.ingestSecret`，Nitropack 只认 `NUXT_INGEST_SECRET`（或 `NITRO_INGEST_SECRET`），**不认无前缀的 `INGEST_SECRET`**。在 Cloudflare 里配成 `INGEST_SECRET` 会让 `/api/ingest` 返回 500「服务端未配置 INGEST_SECRET」。
3. **采集器侧一律无前缀**：`INGEST_SECRET` / `INGEST_URL` 直接给 Python 用。

> 本地 `.env` 需要把上面两组都写上（见 `.env.example`）：`NUXT_INGEST_SECRET` 给服务端、`INGEST_SECRET` 给采集器，二者值相同。

---

## 2. 前置准备

- Node.js ≥ 24（推荐 24 LTS / 26；`package.json` 的 `engines` 已限制 `>=24`）
- 一个 GitHub 账号
- 一个 Cloudflare 账号（免费版即可）
- 安装 wrangler（可选，但推荐）：`npm i -g wrangler` 或 `npx wrangler`

> 国内网络直接 `npm run dev`（会拉 workerd 二进制）可能卡住，本地开发请始终用 `npm run dev:local`。

---

## 3. 本地运行（A 备模式，先跑通再上云）

本机直接跑，D1 用 `node:sqlite` 模拟，适合开发调试与离线验证。**强烈建议先在本机跑通全链路，再部署到 Cloudflare。**

```bash
# 1. 安装依赖（postinstall 自动执行 nuxt prepare）
npm install

# 2. 复制环境变量（.env 不会自动生成，必须手动创建）
cp .env.example .env
#    然后编辑 .env，至少把以下两项改成随机值（两者值要相同）：
#      NUXT_INGEST_SECRET=一段随机32+字符
#      INGEST_SECRET=同一段随机值

# 3. 启动本地开发（自动建 .data/local.db 并应用迁移）
npm run dev:local
```

- `npm run dev:local` 首次运行会在 `.data/local.db` 建好本地库并跑迁移（`scripts/local-db.mjs` 负责，**它不会生成 `.env`**，所以第 2 步不能省）。
- 可选：灌入演示数据并顺带验证 HMAC 链路 → `npm run db:seed:demo`，然后访问 `http://localhost:3000`。

### 常用本地脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev:local` | 本地开发（带 D1 shim，纯 Node） |
| `npm run build:local` | 本地生产构建 |
| `npm run preview:local` | 预览本地构建产物 |
| `npm run db:local:reset` | 重置本地数据库（`--reset` 删库重建） |
| `npm run db:seed:demo` | 灌入演示数据，同时验证 HMAC 签名链路 |
| `npm run collect:local` | 运行 Python 采集器（需先配好 akshare / pywencai） |
| `npm run collect:local:today` | 采集「今天」数据（同上） |

---

## 4. 创建 Cloudflare D1 数据库

```bash
npx wrangler d1 create king-scale-midas-db
```

命令返回一段 `[[d1_databases]]` 配置，记录其中的 `database_id`，填入项目根目录 `wrangler.toml`（已存在占位符 `REPLACE_WITH_YOUR_D1_DATABASE_ID`）：

```toml
[[d1_databases]]
binding = "DB"
database_name = "king-scale-midas-db"
database_id = "<你的 database_id>"
```

> `wrangler.toml` 已配置 `main`、静态资源 `assets` 绑定与 `migrations_dir`，**只需替换 `database_id`**，其余不用动。

---

## 5. 应用数据库迁移

迁移文件在 `server/db/migrations/`，经由 `wrangler.toml` 的 `migrations_dir` 定位。

```bash
# 应用到远程 D1（部署前必做）
npm run db:migrate:remote

# 或本地 wrangler dev 环境
npm run db:migrate:local
```

若后续改了表结构：先 `npm run db:generate` 生成新迁移，再 `npm run db:migrate:remote` 应用。

---

## 6. 部署到 Cloudflare Workers

### 6.1 设置密钥（关键：必须 `NUXT_` 前缀）

在 **Cloudflare Dashboard → Workers & Pages → king-scale-midas → Settings → Variables** 中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NUXT_INGEST_SECRET` | 采集器 HMAC 签名密钥（**带 `NUXT_` 前缀**） | 随机 32+ 字符 |
| `NUXT_SESSION_SECRET` | 会话 cookie 签名密钥（**带 `NUXT_` 前缀**） | 随机 32+ 字符 |

或者用 CLI（推荐用于真实密钥，避免明文留在 Dashboard）：

```bash
npx wrangler secret put NUXT_INGEST_SECRET
npx wrangler secret put NUXT_SESSION_SECRET
```

> ⚠️ **不要**在这里配成 `INGEST_SECRET` / `SESSION_SECRET`。Nuxt runtimeConfig 只认 `NUXT_` 前缀，配错会导致 `/api/ingest` 报「服务端未配置」、采集器全部 401。
> 这个值要与 GitHub Actions 里的 `INGEST_SECRET` **完全一致**（见第 7 节）。

### 6.2 构建并部署

```bash
npm run build
# wrangler.toml 已声明 main + assets，直接 deploy 即可：
npx wrangler deploy
# 等价显式写法（二选一）：
# npx wrangler deploy .output/server/index.mjs --assets .output/public
```

部署成功后，wrangler 会输出 Workers URL，例如：
`https://king-scale-midas.<你的子域>.workers.dev`

### 6.3 部署后验证（强烈建议，能提前发现密钥没配对）

用错误签名打一下 `/api/ingest`，看返回码区分问题：

```bash
# 本地
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" -H "x-signature: bad" -d '{}'

# 线上（把域名换成你的）
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://king-scale-midas.<子域>.workers.dev/api/ingest \
  -H "Content-Type: application/json" -H "x-signature: bad" -d '{}'
```

- 返回 **`401`** → 密钥已正确加载（服务端读到了 `NUXT_INGEST_SECRET`，只是签名不对）。✅ 正常。
- 返回 **`500`** 且响应含「服务端未配置 INGEST_SECRET」→ 密钥**没被读到**，回到 6.1 确认变量名是 `NUXT_INGEST_SECRET`（带前缀）。❌
- 也可用 `curl -s ...` 直接看响应体定位原因。

---

## 7. 配置 GitHub Actions 自动采集（B 主，盘后触发）

### 7.1 获取采集入口 URL

部署成功后，采集接口为：

```
POST https://<你的 Workers 域名>/api/ingest
```

### 7.2 在 GitHub 仓库设置 Secrets

进入仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret | 值 |
|--------|-----|
| `INGEST_URL` | `https://<你的 Workers 域名>/api/ingest` |
| `INGEST_SECRET` | 与 Cloudflare 的 `NUXT_INGEST_SECRET` **完全相同**的 HMAC 密钥（注意这里**无前缀**） |

### 7.3 启用工作流

仓库已有 `.github/workflows/collect.yml`，默认在 **A 股收盘后约 15:30（北京时间，工作日周一至周五）** 自动运行（cron `30 7 * * 1-5`，即 UTC 07:30）。

手动触发：

```bash
gh workflow run collect.yml
# 或在 GitHub 仓库 → Actions → Collect A-Share Limit Data → Run workflow
```

---

## 8. 本地采集作为备份（A 备）

如果 GitHub Actions 因网络或数据源（akshare / pywencai）问题失败，可在本机补跑：

```bash
cd king-scale-midas
pip install -r collector/requirements.txt
export INGEST_URL=https://<你的 Workers 域名>/api/ingest
export INGEST_SECRET=<与 Cloudflare NUXT_INGEST_SECRET 相同的值>
python collector/run.py                # 今天
python collector/run.py --date 20260801 # 指定交易日
```

采集器用 HMAC-SHA256 签名后 POST 到 Workers。

---

## 9. 首个用户注册与审核

1. 打开站点，点击注册，填写邮箱 / 用户名 / 密码。
2. **第一个注册用户会自动成为管理员**（库为空时自举）。
3. 后续新用户注册后状态为 `pending`，需管理员在 `/admin` 页面审核通过才能登录。

---

## 10. 更新（代码变更后重新部署）

```bash
git pull
npm install
npm run build
npx wrangler deploy
```

若数据库结构有变更：先 `npm run db:generate` 生成迁移，再 `npm run db:migrate:remote` 应用，最后重新部署。

---

## 11. 常见问题（FAQ）

### Q：`nuxt dev` 在本机卡住 / workerd 下载失败？
A：国内网络访问 GitHub 下载 workerd 二进制常被墙。直接用 `npm run dev:local`，无需 workerd，也不依赖 Cloudflare。

### Q：采集到的涨停原因为空？
A：数据源不保证 100% 提供原因。系统会尽量抓取；用户可在个股详情页手动补全（普通用户仅自己可见，管理员审核后可设为全局）。

### Q：构建产物过大？
A：当前产物约 760 kB / 260 kB gzip，在 Cloudflare 免费版限制内。

### Q：部署后采集器一直 401 / 500「服务端未配置 INGEST_SECRET」？
A：这是**密钥命名错误**最常见症状。检查：
- Cloudflare 变量名必须是 `NUXT_INGEST_SECRET`（带前缀），不是 `INGEST_SECRET`；
- GitHub Actions 的 `INGEST_SECRET` 值必须与 Cloudflare 的 `NUXT_INGEST_SECRET` **逐字相同**；
- 用第 6.3 节的验证命令确认：返回 401 即密钥已加载，500「未配置」即命名还需修正。

### Q：本地 `.env` 要配哪些？
A：`.env.example` 已含全部四项，复制后**改值**即可：
- `NUXT_INGEST_SECRET` / `NUXT_SESSION_SECRET`：Nuxt 服务端（带前缀）；
- `INGEST_SECRET` / `INGEST_URL`：Python 采集器（无前缀），其中 `INGEST_SECRET` 与上面的 `NUXT_INGEST_SECRET` 值相同。

---

## 12. 命令汇总（cheat sheet）

```bash
# —— 本地 A 备 ——
npm install
cp .env.example .env            # 编辑：设 NUXT_INGEST_SECRET / INGEST_SECRET（同值）
npm run dev:local               # 起本地服务（自动建 .data/local.db + 迁移）
npm run db:seed:demo            # 灌演示数据 + 验证 HMAC 链路

# —— 部署 B 主 ——
npx wrangler d1 create king-scale-midas-db     # 记得填 database_id 到 wrangler.toml
npm run db:migrate:remote                      # 应用迁移到远程 D1
npx wrangler secret put NUXT_INGEST_SECRET     # 设密钥（必须 NUXT_ 前缀）
npx wrangler secret put NUXT_SESSION_SECRET
npm run build
npx wrangler deploy

# —— 验证 ——
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<你的域名>/api/ingest \
  -H "Content-Type: application/json" -H "x-signature: bad" -d '{}'   # 期望 401

# —— GitHub Actions 密钥 ——
#   Settings → Secrets → Actions 加 INGEST_URL / INGEST_SECRET（值与上面同）
```

部署完成后，记得把 Workers URL 和 D1 信息同步到团队文档。

/**
 * 金鳞·点石 — Drizzle Schema (Cloudflare D1 / SQLite)
 *
 * 设计原则：
 * 1. 采集幂等：核心表用 UNIQUE(trade_date, stock_code, limit_type)，采集可无脑重跑。
 * 2. 冗余快照：stock_name / industry_name 等必须冗余，股票会改名、行业会调整。
 * 3. 人肉优先：limit_records.is_verified=1 的记录，采集器永不可覆盖（reason_final 受保护）。
 * 4. 派生表：首页情绪用 market_daily_summary，避免对主表实时 GROUP BY（D1 按扫描行数计费）。
 * 5. 涨跌停按 board 分别计算涨跌幅（主板10% / 双创20% / 北交所30% / ST5%）。
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============ 域 A：基础数据（字典 / 参考） ============

/** 股票主数据（name 为当前名，历史名以快照存于 limit_records） */
export const stocks = sqliteTable('stocks', {
  code: text('code').primaryKey(),              // 6 位代码，如 600519
  name: text('name').notNull(),
  board: text('board').notNull(),               // main/cyb/star/bse
  isSt: integer('is_st', { mode: 'boolean' }).notNull().default(false),
  listedDate: text('listed_date'),
  status: text('status').notNull().default('active'), // active/delisted
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  boardIdx: index('stocks_board_idx').on(t.board),
}))

/** 行业字典 */
export const industries = sqliteTable('industries', {
  id: text('id').primaryKey(),                  // 如 SW801010
  name: text('name').notNull(),
  code: text('code'),
})

/** 板块字典（行业板块 / 地域板块 / 风格板块） */
export const sectors = sqliteTable('sectors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('industry'), // industry/region/style
})

/** 概念题材字典 */
export const concepts = sqliteTable('concepts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
})

/** 板块类型与涨跌停幅度（决策依据） */
export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),                 // main/cyb/star/bse/st
  name: text('name').notNull(),
  limitPct: real('limit_pct').notNull(),       // 10/20/30/5
})

/** 交易日历 */
export const tradeCalendar = sqliteTable('trade_calendar', {
  tradeDate: text('trade_date').primaryKey(),  // YYYY-MM-DD
  isTrading: integer('is_trading', { mode: 'boolean' }).notNull().default(true),
  year: integer('year').notNull(),
}, (t) => ({
  yearIdx: index('tc_year_idx').on(t.year),
}))

// ============ 域 B：涨跌停核心 ============

/**
 * 核心表：每日涨跌停记录。
 * 唯一键保证采集幂等；is_verified 保护人工校订数据。
 */
export const limitRecords = sqliteTable('limit_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tradeDate: text('trade_date').notNull(),     // YYYY-MM-DD
  stockCode: text('stock_code').notNull(),
  stockName: text('stock_name').notNull(),     // 冗余快照
  board: text('board').notNull(),
  limitType: text('limit_type').notNull(),     // up(涨停) / down(跌停)
  price: real('price'),
  pct: real('pct'),                            // 涨跌幅 %
  firstLimitTime: text('first_limit_time'),    // 首次封板 HH:MM:SS
  lastLimitTime: text('last_limit_time'),      // 最后封板 HH:MM:SS
  openTimes: integer('open_times').default(0), // 炸板次数
  turnover: real('turnover'),                  // 成交额（元）
  volume: integer('volume'),                   // 成交量（手）
  circMarketCap: real('circ_market_cap'),      // 流通市值（元）
  totalMarketCap: real('total_market_cap'),
  ztCount: integer('zt_count').default(1),     // 连板数（1=首板）
  reasonRaw: text('reason_raw'),               // 机器抓取原因（尽力而为）
  reasonFinal: text('reason_final'),           // 人工最终原因（受 is_verified 保护）
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  source: text('source'),                      // 数据来源 key
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  unq: uniqueIndex('lr_uniq').on(t.tradeDate, t.stockCode, t.limitType),
  dateIdx: index('lr_date_idx').on(t.tradeDate),
  codeIdx: index('lr_code_idx').on(t.stockCode),
  boardIdx: index('lr_board_idx').on(t.board),
  typeIdx: index('lr_type_idx').on(t.limitType),
  ztIdx: index('lr_zt_idx').on(t.ztCount),
}))

/** 涨停原因题材标签（记录 ↔ 概念/板块 多对多） */
export const limitReasonTags = sqliteTable('limit_reason_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  limitRecordId: integer('limit_record_id').notNull()
    .references(() => limitRecords.id, { onDelete: 'cascade' }),
  conceptId: text('concept_id'),
  sectorId: text('sector_id'),
  tagType: text('tag_type').notNull().default('concept'), // concept/sector
  weight: real('weight').default(1),
}, (t) => ({
  unq: uniqueIndex('lrt_uniq').on(t.limitRecordId, t.conceptId, t.tagType),
  recIdx: index('lrt_rec_idx').on(t.limitRecordId),
}))

/** 每日情绪汇总（派生表，首页直接读，避免实时聚合主表） */
export const marketDailySummary = sqliteTable('market_daily_summary', {
  tradeDate: text('trade_date').primaryKey(),
  limitUpCount: integer('limit_up_count').notNull().default(0),
  limitDownCount: integer('limit_down_count').notNull().default(0),
  limitUpOpenCount: integer('limit_up_open_count').notNull().default(0), // 涨停打开数
  ztHeight: integer('zt_height').notNull().default(0),     // 最高连板高度
  firstBoardCount: integer('first_board_count').notNull().default(0), // 首板数
  sealRate: real('seal_rate'),                             // 封板率
  avgPct: real('avg_pct'),
  ytdZtTodayUp: integer('ytd_zt_today_up').default(0),    // 昨日涨停今日上涨数
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})

/** 板块每日表现 */
export const sectorDailyStats = sqliteTable('sector_daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tradeDate: text('trade_date').notNull(),
  sectorId: text('sector_id').notNull(),
  limitUpCount: integer('limit_up_count').notNull().default(0),
  avgPct: real('avg_pct'),
  rank: integer('rank'),
}, (t) => ({
  unq: uniqueIndex('sds_uniq').on(t.tradeDate, t.sectorId),
}))

/** 行业每日表现 */
export const industryDailyStats = sqliteTable('industry_daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tradeDate: text('trade_date').notNull(),
  industryId: text('industry_id').notNull(),
  limitUpCount: integer('limit_up_count').notNull().default(0),
  avgPct: real('avg_pct'),
  rank: integer('rank'),
}, (t) => ({
  unq: uniqueIndex('ids_uniq').on(t.tradeDate, t.industryId),
}))

/** 股票每日行情快照（回看用，不依赖第三方实时接口） */
export const stockDailyQuote = sqliteTable('stock_daily_quote', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tradeDate: text('trade_date').notNull(),
  stockCode: text('stock_code').notNull(),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  close: real('close'),
  preClose: real('pre_close'),
  pct: real('pct'),
  amount: real('amount'),
  turnoverRate: real('turnover_rate'),
}, (t) => ({
  unq: uniqueIndex('sdq_uniq').on(t.tradeDate, t.stockCode),
}))

// ============ 域 C：用户与权限 ============

/** 用户（注册后 status=pending，需管理员审核通过才 active） */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // PBKDF2: salt:hash
  status: text('status').notNull().default('pending'), // pending/active/disabled
  role: text('role').notNull().default('user'),  // user/admin
  // 自引用会破坏 TS 类型推断，通过返回类型断言绕过循环依赖
  approvedBy: integer('approved_by').references((): AnySQLiteColumn => users.id),
  approvedAt: text('approved_at'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  statusIdx: index('users_status_idx').on(t.status),
}))

/** 角色字典（预留 RBAC） */
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

/** 用户 ↔ 角色 */
export const userRoles = sqliteTable('user_roles', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: index('ur_pk').on(t.userId, t.roleId),
}))

/** 会话表（自实现：随机 token + D1 存储，CF 免费版友好） */
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // SHA-256(token)
  expiresAt: text('expires_at').notNull(),          // ISO
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  userIdx: index('sess_user_idx').on(t.userId),
}))

/** 权限字典 */
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
})

/** 角色 ↔ 权限 */
export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: index('rp_pk').on(t.roleId, t.permissionId),
}))

/** 审核 / 操作日志 */
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  detail: text('detail'),                         // JSON
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  actorIdx: index('al_actor_idx').on(t.actorId),
}))

// ============ 域 D：系统 ============

/** 采集运行记录 */
export const ingestRuns = sqliteTable('ingest_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runAt: text('run_at').notNull().default(sql`(current_timestamp)`),
  source: text('source').notNull(),
  tradeDate: text('trade_date'),
  status: text('status').notNull().default('success'), // success/partial/failed
  fetched: integer('fetched').default(0),
  inserted: integer('inserted').default(0),
  updated: integer('updated').default(0),
  skipped: integer('skipped').default(0),        // 被 is_verified 保护跳过
  error: text('error'),
  durationMs: integer('duration_ms'),
})

/** 数据源配置 */
export const dataSources = sqliteTable('data_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),                  // limit_pool/reason/quote
  adapter: text('adapter').notNull(),            // akshare/pywencai/...
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  note: text('note'),
})

/** 用户对记录的人工备注 / 原因补全（不可被采集覆盖） */
export const userNotes = sqliteTable('user_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  limitRecordId: integer('limit_record_id').notNull()
    .references(() => limitRecords.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  note: text('note'),
  reasonOverride: text('reason_override'),       // 用户补全的涨停原因
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  recIdx: index('un_rec_idx').on(t.limitRecordId),
  // 一个用户对一条记录只保留一份补全，重复保存走 upsert
  unq: uniqueIndex('un_rec_user_uniq').on(t.limitRecordId, t.userId),
}))

/** 自选 / 关注池 */
export const watchlists = sqliteTable('watchlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('stock'), // stock/sector/concept
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  userIdx: index('wl_user_idx').on(t.userId),
}))

/** 关注池条目 */
export const watchlistItems = sqliteTable('watchlist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  watchlistId: integer('watchlist_id').notNull().references(() => watchlists.id, { onDelete: 'cascade' }),
  refCode: text('ref_code').notNull(),           // stock_code / sector_id / concept_id
  refName: text('ref_name'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  wlIdx: index('wli_wl_idx').on(t.watchlistId),
}))

// 全部表汇总（供 db 初始化与类型推导）
export const schema = {
  stocks, industries, sectors, concepts, boards, tradeCalendar,
  limitRecords, limitReasonTags, marketDailySummary, sectorDailyStats, industryDailyStats, stockDailyQuote,
  users, roles, userRoles, sessions, permissions, rolePermissions, auditLogs,
  ingestRuns, dataSources, userNotes, watchlists, watchlistItems,
}

// 行类型（供服务端工具与路由使用）
export type User = typeof users.$inferSelect
export type LimitRecord = typeof limitRecords.$inferSelect
export type SessionRow = typeof sessions.$inferSelect

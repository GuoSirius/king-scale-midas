/** 市场相关枚举 —— 采集器、后端校验、前端筛选器三方共用，防止字符串写岔 */

/** 涨跌停方向 */
export const LIMIT_TYPES = ['up', 'down'] as const
export type LimitType = (typeof LIMIT_TYPES)[number]

/** 上市板块 */
export const BOARDS = ['main', 'gem', 'star', 'bse'] as const
export type Board = (typeof BOARDS)[number]

export const BOARD_LABELS: Record<Board, string> = {
  main: '主板',
  gem: '创业板',
  star: '科创板',
  bse: '北交所'
}

/** 各板块涨跌停幅度限制（%），ST 股另算 */
export const BOARD_LIMIT_PCT: Record<Board, number> = {
  main: 10,
  gem: 20,
  star: 20,
  bse: 30
}

/** 用户状态 */
export const USER_STATUSES = ['pending', 'active', 'disabled'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** 用户角色 */
export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** 无需登录即可访问的页面路径（全站鉴权白名单） */
export const PUBLIC_ROUTES = ['/login', '/register'] as const

/** 无需登录即可访问的接口前缀（机器投递与登录态自身） */
export const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/ingest'
] as const

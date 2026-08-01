import type { Board, LimitType, UserRole, UserStatus } from '../constants/market'

/** 当前登录用户（/api/auth/me） */
export interface SessionUser {
  id: number
  email: string
  username: string
  role: UserRole
  status: UserStatus
}

/** 一条涨跌停记录 */
export interface LimitRecord {
  id: number
  tradeDate: string
  code: string
  name: string
  board: Board | string
  limitType: LimitType
  pct: number | null
  price: number | null
  amount: number | null
  turnover: number | null
  marketCap: number | null
  ztCount: number | null
  openTimes: number | null
  firstLimitAt: string | null
  lastLimitAt: string | null
  sealAmount: number | null
  reasonRaw: string | null
  reasonFinal: string | null
  isVerified: boolean
}

/** 板块日榜一行 */
export interface SectorStat {
  sectorId: string | null
  name: string | null
  limitUpCount: number
  avgPct: number | null
  rank: number | null
}

/** 大盘情绪概览（/api/summary） */
export interface MarketSummary {
  tradeDate: string | null
  limitUpCount: number
  limitDownCount: number
  brokenCount: number
  maxZtCount: number
  firstBoardCount: number
  sealRate: number
  topSectors: SectorStat[]
  topConcepts: { id: string, name: string, count: number }[]
}

/** 分页列表通用返回 */
export interface PagedResult<T> {
  total: number
  rows: T[]
}

/** 原因补全接口返回：global = 管理员写入全局，personal = 仅本人可见 */
export interface PatchRecordResult {
  ok: boolean
  scope: 'global' | 'personal' | 'none'
}

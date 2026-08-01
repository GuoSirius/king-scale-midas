/**
 * 展示层格式化 —— 前端渲染与后端生成摘要文案时共用，保证同一个数字在任何地方长得一样。
 * Nuxt 4 会把 shared/utils 自动导入到 app 与 server 两侧，无需手动 import。
 */

/** 涨跌幅：保留两位并带正负号 */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 金额：自动切换 亿 / 万 单位 */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return String(Math.round(value))
}

/** 价格：统一两位小数 */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

/** 连板高度：1 板显示「首板」，其余显示「N 连板」 */
export function formatZtCount(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  if (!n) return '—'
  return n === 1 ? '首板' : `${n}连板`
}

/** YYYY-MM-DD → MM-DD */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return '—'
  return date.length === 10 ? date.slice(5) : date
}

/** 今天的交易日字符串（本地时区，YYYY-MM-DD） */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

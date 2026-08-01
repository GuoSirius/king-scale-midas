#!/usr/bin/env node
/**
 * 演示数据播种（本地 A 备方案）—— 直写 .data/local.db，无需启动服务、无需联网。
 *
 * 为什么直接写库而不是走 /api/ingest：
 *   - 新增的分析维度表（dragon_tiger / limit_related / market_index_daily /
 *     market_daily_summary / sector_daily_stats / industry_daily_stats）采集器尚未写入；
 *   - 直写能一次性把「趋势 / 柱状图 / 龙虎榜 / 关联图」以及「年度·同月·大盘对比」所需的
 *     多日聚合数据都铺满，纯前端也能立刻看到效果。
 *
 * 覆盖内容：
 *   1) limit_records        —— 含新增列 sector/industry/open_time/pattern_days/
 *                               pattern_boards/next_open_prediction/next_open_actual
 *   2) dragon_tiger         —— 龙虎榜席位买卖数据
 *   3) limit_related        —— 同题材 / 同板块 / 龙头跟风 关联
 *   4) market_index_daily   —— 上证 / 深成 / 创业板 三大指数日线（用于大盘对比）
 *   5) market_daily_summary —— 约 500 交易日（≈2 年）每日情绪汇总（趋势图数据源）
 *   6) sector/industry_daily_stats —— 最近 60 交易日板块 / 行业表现
 *   7) users                —— 一个 active 演示账号，可直接登录并测试受保护接口
 *
 * 幂等：每次运行先清空 demo 专属表（users 仅删 demo 账号），可重复执行。
 *
 * 用法：
 *   node scripts/local-db.mjs            # 先确保表结构已建（dev:local 会自动跑）
 *   node scripts/seed-demo.mjs           # 播种
 *   LOCAL_D1_PATH=/abs/path/local.db node scripts/seed-demo.mjs
 */

import { DatabaseSync } from 'node:sqlite'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

async function main() {
  const root = process.cwd()
  const dataDir = resolve(root, '.data')
  const dbPath = process.env.LOCAL_D1_PATH || join(dataDir, 'local.db')
  if (!existsSync(dbPath)) {
    console.error(`[seed-demo] 找不到本地库 ${dbPath}`)
    console.error('[seed-demo] 请先执行：`node scripts/local-db.mjs`（或跑一次 `npm run dev:local`）初始化表结构。')
    process.exit(1)
  }

  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = OFF') // 演示数据自由插，无需外键约束

  const hasTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='limit_records'"
  ).get()
  if (!hasTable) {
    console.error('[seed-demo] limit_records 表不存在，请先执行 `node scripts/local-db.mjs` 应用迁移。')
    process.exit(1)
  }

  const run = (sql, ...params) => db.prepare(sql).run(...params)
  // 本机 node:sqlite 版本未暴露 db.transaction，手动用 BEGIN/COMMIT 包事务
  const runTx = (fn) => {
    db.exec('BEGIN')
    try {
      fn()
      db.exec('COMMIT')
    } catch (err) {
      try { db.exec('ROLLBACK') } catch { /* ignore */ }
      throw err
    }
  }

  // ---------- 0. 清场（幂等） ----------
  console.log('[seed-demo] 清空旧 demo 数据 …')
  runTx(() => {
    for (const t of [
      'dragon_tiger', 'limit_related', 'sector_daily_stats', 'industry_daily_stats',
      'market_index_daily', 'market_daily_summary', 'limit_records'
    ]) {
      run(`DELETE FROM ${t}`)
    }
    run("DELETE FROM users WHERE email = ?", DEMO_USER.email)
  })

  // ---------- 1. 演示用户（active，可直接登录） ----------
  const passwordHash = await hashPassword(DEMO_USER.password)
  run(
    `INSERT INTO users (email, username, password_hash, status, role, created_at, updated_at)
     VALUES (?, ?, ?, 'active', 'user', current_timestamp, current_timestamp)`,
    DEMO_USER.email, DEMO_USER.username, passwordHash
  )
  console.log(`[seed-demo] 演示账号已建：${DEMO_USER.email} / ${DEMO_USER.password}`)

  // ---------- 2. 交易日历（约 2 年 ≈ 500 交易日，最近 60 天有明细） ----------
  const allDays = genTradingDays(SUMMARY_DAYS)
  const detailDays = allDays.slice(-DETAIL_DAYS)

  // 每个交易日一个「市场情绪」值（0~1），明细与汇总共用，保证自洽
  const sentimentByDate = new Map()
  allDays.forEach((date, i) => sentimentByDate.set(date, sentimentFor(i, allDays.length)))

  // ---------- 3. 每日情绪汇总 + 三大指数日线（趋势 / 大盘对比图） ----------
  console.log(`[seed-demo] 生成 ${allDays.length} 个交易日的市场汇总与指数日线 …`)
  runTx(() => {
    let sh = 3000, sz = 9500, cyb = 1900
    allDays.forEach((date) => {
      const s = sentimentByDate.get(date)
      const limitUp = Math.round(lerp(25, 140, s) + (rnd() - 0.5) * 20)
      const limitDown = Math.round(lerp(60, 8, s) + (rnd() - 0.5) * 12)
      const ztHeight = Math.round(lerp(3, 11, s) + rnd() * 2)
      const firstBoard = Math.round(limitUp * (0.4 + rnd() * 0.3))
      const sealRate = clamp(0.65 + s * 0.25 + (rnd() - 0.5) * 0.1, 0.4, 0.99)
      const avgPct = round2(lerp(-1.5, 4.0, s) + (rnd() - 0.5) * 1.5)
      run(
        `INSERT INTO market_daily_summary
           (trade_date, limit_up_count, limit_down_count, limit_up_open_count, zt_height,
            first_board_count, seal_rate, avg_pct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        date, limitUp, limitDown, Math.round(limitUp * 0.15), ztHeight, firstBoard, sealRate, avgPct
      )

      // 三大指数
      const indices = [
        { code: 'sh000001', name: '上证指数', level: sh },
        { code: 'sz399001', name: '深证成指', level: sz },
        { code: 'cyb399006', name: '创业板指', level: cyb }
      ]
      for (const idx of indices) {
        const pct = round2(lerp(-1.8, 1.8, s) + (rnd() - 0.5) * 1.0)
        const preClose = idx.level
        const close = round2(preClose * (1 + pct / 100))
        const open = round2(preClose * (1 + (rnd() - 0.5) * 0.012))
        const high = round2(Math.max(open, close) * (1 + rnd() * 0.008))
        const low = round2(Math.min(open, close) * (1 - rnd() * 0.008))
        const vol = Math.round(lerp(2.5, 6.5, s) * 1e8)
        const amount = round2(lerp(2800, 7200, s) * 1e8)
        run(
          `INSERT INTO market_index_daily
             (trade_date, index_code, index_name, open, high, low, close, pre_close, pct, volume, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          date, idx.code, idx.name, open, high, low, close, preClose, pct, vol, amount
        )
        idx.level = close
      }
      sh = indices[0].level
      sz = indices[1].level
      cyb = indices[2].level
    })
  })

  // ---------- 4. 最近 60 交易日明细（每只票 + 龙虎榜 + 关联 + 板块行业统计） ----------
  console.log(`[seed-demo] 生成 ${detailDays.length} 个交易日的涨跌停明细 …`)
  runTx(() => {
    for (const date of detailDays) {
      const s = sentimentByDate.get(date)
      const nUp = Math.round(clamp(lerp(8, 18, s) + (rnd() - 0.5) * 4, 5, 22))
      const nDown = Math.round(clamp(lerp(6, 2, s) + (rnd() - 0.5) * 2, 1, 9))

      const pool = [...STOCKS]
      shuffle(pool)
      const upPicks = pool.slice(0, nUp)
      const downPicks = pool.slice(nUp, nUp + nDown)

      const daySectorAgg = new Map() // sector -> {count, pctSum}
      const dayIndustryAgg = new Map()

      for (const st of upPicks) {
        const id = insertLimitRecord(run, date, st, 'up')
        tally(daySectorAgg, st.sector, 1, st.pctUp)
        tally(dayIndustryAgg, st.industry, 1, st.pctUp)
        maybeDragonTiger(run, date, st, id)
        maybeRelated(run, date, st, id, upPicks.concat(downPicks))
      }
      for (const st of downPicks) {
        insertLimitRecord(run, date, st, 'down')
        tally(daySectorAgg, st.sector, 1, st.pctDown)
        tally(dayIndustryAgg, st.industry, 1, st.pctDown)
      }

      // 板块 / 行业当日表现
      const sectorRows = [...daySectorAgg.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([sector, v], i) => [date, sector, v.count, round2(v.pctSum / v.count), i + 1])
      for (const r of sectorRows) {
        run(
          `INSERT INTO sector_daily_stats (trade_date, sector_id, limit_up_count, avg_pct, rank)
           VALUES (?, ?, ?, ?, ?)`,
          ...r
        )
      }
      const indRows = [...dayIndustryAgg.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([industry, v], i) => [date, industry, v.count, round2(v.pctSum / v.count), i + 1])
      for (const r of indRows) {
        run(
          `INSERT INTO industry_daily_stats (trade_date, industry_id, limit_up_count, avg_pct, rank)
           VALUES (?, ?, ?, ?, ?)`,
          ...r
        )
      }
    }
  })

  // ---------- 5. 汇总 ----------
  const counts = {
    users: db.prepare('SELECT count(*) c FROM users WHERE email=?').get(DEMO_USER.email).c,
    limitRecords: db.prepare('SELECT count(*) c FROM limit_records').get().c,
    dragonTiger: db.prepare('SELECT count(*) c FROM dragon_tiger').get().c,
    limitRelated: db.prepare('SELECT count(*) c FROM limit_related').get().c,
    marketDailySummary: db.prepare('SELECT count(*) c FROM market_daily_summary').get().c,
    marketIndexDaily: db.prepare('SELECT count(*) c FROM market_index_daily').get().c,
    sectorDailyStats: db.prepare('SELECT count(*) c FROM sector_daily_stats').get().c,
    industryDailyStats: db.prepare('SELECT count(*) c FROM industry_daily_stats').get().c
  }
  console.log('[seed-demo] 完成 ✅')
  console.table(counts)
  console.log(`[seed-demo] 数据区间：${allDays[0]} ~ ${allDays[allDays.length - 1]}`)
  console.log('[seed-demo] 启动后即可用 demo 账号登录并查看分析图表。')
  db.close()
}

// ====================== 数据 / 工具函数 ======================

const SUMMARY_DAYS = 500 // ≈ 2 年交易日
const DETAIL_DAYS = 60 // 有逐笔明细的最近交易日

const DEMO_USER = { email: 'demo@king-scale.test', username: 'demo', password: 'demo1234' }

/** 主题 → 板块 / 行业 / 涨停原因池 / 股票池 */
const THEMES = [
  { sector: '人工智能', industry: '软件开发', reasons: ['AI大模型突破', '算力需求爆发', 'AI应用落地'], stocks: [
    ['002230', '科大讯飞', 'main'], ['688111', '金山办公', 'star'], ['300624', '万兴科技', 'cyb'],
    ['300229', '拓尔思', 'cyb'], ['601360', '三六零', 'main']
  ] },
  { sector: '半导体', industry: '半导体', reasons: ['国产替代加速', '半导体景气回升', '设备订单大增'], stocks: [
    ['688981', '中芯国际', 'star'], ['688256', '寒武纪', 'star'], ['603986', '兆易创新', 'main'],
    ['002049', '紫光国微', 'main'], ['688041', '海光信息', 'star']
  ] },
  { sector: '新能源车', industry: '汽车整车', reasons: ['以旧换新政策', '销量超预期', '智能驾驶催化'], stocks: [
    ['002594', '比亚迪', 'main'], ['601127', '赛力斯', 'main'], ['000625', '长安汽车', 'main'],
    ['600733', '北汽蓝谷', 'main']
  ] },
  { sector: '新能源', industry: '电池', reasons: ['固态电池量产', '储能需求增长'], stocks: [
    ['300750', '宁德时代', 'cyb'], ['002460', '赣锋锂业', 'main'], ['300014', '亿纬锂能', 'cyb']
  ] },
  { sector: '通信', industry: '通信设备', reasons: ['800G需求放量', '算力网络建设'], stocks: [
    ['300308', '中际旭创', 'cyb'], ['300502', '新易盛', 'cyb'], ['002281', '光迅科技', 'main']
  ] },
  { sector: '大消费', industry: '酿酒行业', reasons: ['消费复苏', '旺季预期'], stocks: [
    ['600519', '贵州茅台', 'main'], ['000858', '五粮液', 'main'], ['000568', '泸州老窖', 'main']
  ] },
  { sector: '医药', industry: '医疗服务', reasons: ['创新药出海', 'CXO订单回暖'], stocks: [
    ['603259', '药明康德', 'main'], ['300760', '迈瑞医疗', 'cyb'], ['688177', '百济神州', 'star']
  ] },
  { sector: '大金融', industry: '证券', reasons: ['券商业绩改善', '市场交投活跃'], stocks: [
    ['300059', '东方财富', 'cyb'], ['600030', '中信证券', 'main'], ['601688', '华泰证券', 'main']
  ] },
  { sector: '资源', industry: '贵金属', reasons: ['金价创新高', '避险需求'], stocks: [
    ['601899', '紫金矿业', 'main'], ['600547', '山东黄金', 'main'], ['002155', '湖南黄金', 'main']
  ] },
  { sector: '北交所', industry: '通用设备', reasons: ['北交所活跃', '小盘风格'], stocks: [
    ['920002', '万达轴承', 'bse'], ['835174', '五新隧装', 'bse'], ['830799', '艾融软件', 'bse']
  ] }
]

/** 展开成逐只票的定义 */
const STOCKS = THEMES.flatMap((t) =>
  t.stocks.map(([code, name, board]) => ({
    code, name, board,
    sector: t.sector,
    industry: t.industry,
    reasons: t.reasons,
    pctUp: board === 'bse' ? 30 : board === 'main' ? 10 : 20,
    pctDown: board === 'bse' ? -30 : board === 'main' ? -10 : -20,
    openProb: 0.3 + Math.random() * 0.2
  }))
)

const SEATS = [
  '东方财富拉萨团结路', '机构专用', '沪股通专用', '深股通专用',
  '华鑫证券上海分公司', '国君上海江苏路', '中信杭州延安路',
  '作手新一', '方新侠', '上塘路', '呼家楼', '量化基金'
]

const NEXT_OPEN_PRED = [
  { text: '一字板', lo: 9.5, hi: 10 },
  { text: '高开', lo: 3, hi: 8 },
  { text: '小幅高开', lo: 1, hi: 4 },
  { text: '平开', lo: -1, hi: 1.5 },
  { text: '冲高回落', lo: -2, hi: 3 },
  { text: '低开', lo: -4, hi: -0.5 }
]

/** 插入一条涨跌停记录，返回自增 id */
function insertLimitRecord(run, date, st, limitType) {
  const isUp = limitType === 'up'
  const ztCount = isUp ? sampleZtCount() : 1
  const pct = isUp ? st.pctUp : st.pctDown
  const firstTime = randTime(9, 10)
  const openTime = isUp && rnd() < st.openProb ? randTime(9, 14) : null
  const openTimes = openTime ? Math.ceil(rnd() * 3) : 0
  const lastTime = openTimes > 0 ? '14:52:00' : firstTime

  let patternDays = null
  let patternBoards = null
  if (isUp && ztCount >= 2) {
    patternBoards = ztCount
    patternDays = ztCount + Math.floor(rnd() * 3)
  }

  // 次日开盘预期 / 实际
  const pred = NEXT_OPEN_PRED[Math.floor(rnd() * NEXT_OPEN_PRED.length)]
  const nextOpenActual = isUp ? round2(lerp(pred.lo, pred.hi, rnd()) + (rnd() - 0.5)) : round2(lerp(-5, -1, rnd()))
  const reason = isUp
    ? st.reasons[Math.floor(rnd() * st.reasons.length)]
    : ['业绩不及预期', '高位杀跌', '减持公告', '行业利空', 'ST风险'][Math.floor(rnd() * 5)]

  const price = round2(lerp(8, 320, rnd()))
  const turnover = round2(lerp(2, 60, rnd()) * 1e8)
  const volume = Math.round(lerp(1, 30, rnd()) * 1e6)
  const circCap = round2(lerp(50, 3000, rnd()) * 1e8)
  const totalCap = round2(lerp(60, 4000, rnd()) * 1e8)

  const info = run(
    `INSERT INTO limit_records
       (trade_date, stock_code, stock_name, board, limit_type, price, pct,
        first_limit_time, last_limit_time, open_times, open_time, turnover,
        volume, circ_market_cap, total_market_cap, zt_count,
        sector, industry, pattern_days, pattern_boards,
        next_open_prediction, next_open_actual, reason_raw, reason_final, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed-demo')`,
    date, st.code, st.name, st.board, limitType, price, pct,
    firstTime, lastTime, openTimes, openTime, turnover,
    volume, circCap, totalCap, ztCount,
    st.sector, st.industry, patternDays, patternBoards,
    pred.text, nextOpenActual, reason, isUp ? reason : null
  )
  return Number(info.lastInsertRowid)
}

function maybeDragonTiger(run, date, st, limitRecordId) {
  if (rnd() > 0.28 && st._ztHint !== true) {
    // 连板较高或随机命中才上榜
    if (rnd() > 0.25) return
  }
  const n = 1 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const seat = SEATS[Math.floor(rnd() * SEATS.length)]
    const isBuy = rnd() > 0.3
    const buyAmount = isBuy ? round2(lerp(0.2, 3.5, rnd()) * 1e8) : 0
    const sellAmount = !isBuy ? round2(lerp(0.2, 3.5, rnd()) * 1e8) : 0
    const net = isBuy ? buyAmount : -sellAmount
    run(
      `INSERT INTO dragon_tiger
         (trade_date, stock_code, limit_record_id, seat_name, seat_type, rank, buy_amount, sell_amount, net_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      date, st.code, limitRecordId, seat, isBuy ? 'buy' : 'sell', i + 1, buyAmount, sellAmount, net
    )
  }
}

function maybeRelated(run, date, st, limitRecordId, others) {
  if (rnd() > 0.45) return
  const n = 1 + Math.floor(rnd() * 2)
  const shuffled = [...others].filter((o) => o.code !== st.code)
  shuffle(shuffled)
  for (let i = 0; i < Math.min(n, shuffled.length); i++) {
    const rel = shuffled[i]
    const sameTheme = rel.sector === st.sector
    const relationType = sameTheme
      ? (rnd() > 0.5 ? 'leader' : 'follower')
      : (rnd() > 0.5 ? 'same_board' : 'concept')
    run(
      `INSERT INTO limit_related
         (trade_date, stock_code, limit_record_id, related_code, related_name, relation_type, weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      date, st.code, limitRecordId, rel.code, rel.name, relationType, round2(lerp(0.5, 1, rnd()))
    )
  }
}

// ---------- 工具 ----------
function genTradingDays(count) {
  const days = []
  const d = new Date()
  // 锚定到最近一个工作日（今天可能是周末，回退到周五）
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  // 从最近一天往前数 count 个工作日
  while (days.length < count) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${day}`)
    do {
      d.setDate(d.getDate() - 1)
    } while (d.getDay() === 0 || d.getDay() === 6)
  }
  return days.reverse() // 旧 → 新
}

function sentimentFor(i, n) {
  const phase = (i / n) * Math.PI * 4
  const wave = Math.sin(phase)
  const trend = (i / n) * 0.3 - 0.15
  const noise = (rnd() - 0.5) * 0.3
  return clamp(0.5 + wave * 0.25 + trend + noise, 0.05, 0.95)
}

function sampleZtCount() {
  const r = rnd()
  if (r < 0.55) return 1
  if (r < 0.8) return 2
  if (r < 0.92) return 3
  if (r < 0.97) return 4
  return 5 + Math.floor(rnd() * 3)
}

function tally(map, key, count, pct) {
  const v = map.get(key) || { count: 0, pctSum: 0 }
  v.count += count
  v.pctSum += pct
  map.set(key, v)
}

// 确定性 PRNG（mulberry32），相同种子复现相同数据
let _seed = 20260801
function rnd() {
  _seed |= 0
  _seed = (_seed + 0x6d2b79f5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function round2(v) { return Math.round(v * 100) / 100 }
function randTime(h1, h2) {
  const h = h1 + Math.floor(rnd() * (h2 - h1 + 1))
  const m = Math.floor(rnd() * 60)
  const s = Math.floor(rnd() * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 与 server/utils/crypto.ts 完全一致：PBKDF2-SHA256，10万次，256bit，返回 "salt:hash" */
async function hashPassword(password, iterations = 100_000) {
  const enc = new TextEncoder()
  const bufToHex = (b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  )
  return `${bufToHex(salt.buffer)}:${bufToHex(bits)}`
}

main().catch((err) => {
  console.error('[seed-demo] 失败：', err)
  process.exit(1)
})

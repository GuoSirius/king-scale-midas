#!/usr/bin/env node
/**
 * 演示数据播种：构造一批仿真的涨跌停记录，
 * 通过「真实的 HMAC 签名 + /api/ingest」写入，等于顺手把采集链路端到端测一遍。
 *
 * 用途：
 *   1) 本机没装 Python / 不想联网时，先塞点数据把界面跑起来看效果；
 *   2) CI 里做接口冒烟测试。
 *
 * 用法：
 *   node scripts/seed-demo.mjs
 *   INGEST_URL=http://localhost:3000/api/ingest INGEST_SECRET=xxx node scripts/seed-demo.mjs
 */
import { createHmac } from 'node:crypto'

const URL_ = process.env.INGEST_URL || 'http://localhost:3000/api/ingest'
const SECRET = process.env.INGEST_SECRET || process.env.NUXT_INGEST_SECRET || 'dev-ingest-secret'

/** 最近一个工作日 YYYYMMDD */
function lastWorkday() {
  const d = new Date()
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

const TRADE_DATE = process.argv[2] || lastWorkday()

const UP = [
  ['300750', '宁德时代', 'cyb', 6, '固态电池', ['固态电池', '锂电池'], '09:31:00', 0, '电池'],
  ['002594', '比亚迪',   'main', 3, '智能驾驶',  ['智能驾驶', '新能源车'], '09:45:12', 1, '汽车整车'],
  ['688981', '中芯国际', 'star', 2, '国产替代',  ['半导体', '国产替代'], '10:02:33', 0, '半导体'],
  ['600519', '贵州茅台', 'main', 1, '消费复苏',  ['白酒', '消费'], '13:20:41', 2, '酿酒行业'],
  ['300059', '东方财富', 'cyb', 4, '券商行情',  ['券商', '互联网金融'], '09:30:06', 0, '证券'],
  ['002230', '科大讯飞', 'main', 2, 'AI大模型',  ['AI大模型', '人工智能'], '10:15:00', 1, '软件开发'],
  ['603259', '药明康德', 'main', 1, '创新药',    ['创新药', 'CXO'], '14:03:18', 0, '医疗服务'],
  ['601127', '赛力斯',   'main', 5, '华为汽车',  ['华为汽车', '智能驾驶'], '09:30:02', 0, '汽车整车'],
  ['300308', '中际旭创', 'cyb', 3, '光模块',    ['光模块', 'CPO'], '09:33:27', 1, '通信设备'],
  ['688111', '金山办公', 'star', 1, 'AI办公',   ['AI大模型', '信创'], '11:04:55', 0, '软件开发'],
  ['002415', '海康威视', 'main', 1, '安防复苏',  ['安防', '人工智能'], '14:22:09', 3, '安防设备'],
  ['300760', '迈瑞医疗', 'cyb', 2, '医疗设备',  ['医疗器械'], '10:41:12', 0, '医疗器械'],
  ['601899', '紫金矿业', 'main', 1, '黄金上涨',  ['黄金', '有色金属'], '13:55:30', 1, '贵金属'],
  ['000858', '五粮液',   'main', 1, '消费复苏',  ['白酒', '消费'], '14:31:00', 2, '酿酒行业'],
  ['688256', '寒武纪',   'star', 4, '国产算力',  ['算力', '人工智能', '国产替代'], '09:30:01', 0, '半导体'],
  ['920002', '万达轴承', 'bse', 2, '北交所活跃', ['北交所'], '10:10:10', 0, '通用设备'],
]

const DOWN = [
  ['002913', '奥士康', 'main', '业绩暴雷', ['PCB'], '印制电路板'],
  ['300888', '稳健医疗', 'cyb', '订单下滑', ['医疗器械'], '医疗器械'],
  ['603929', '亚翔集成', 'main', '高位杀跌', ['半导体'], '专业工程'],
  ['688169', '石头科技', 'star', '减持公告', ['小家电'], '家用轻工'],
  ['000980', '众泰汽车', 'main', 'ST风险', ['汽车整车'], '汽车整车'],
]

const rnd = (min, max, dec = 2) => Number((min + Math.random() * (max - min)).toFixed(dec))

const records = [
  ...UP.map(([code, name, board, zt, reason, tags, t, openTimes, industry]) => ({
    stock_code: code,
    stock_name: name,
    board,
    limit_type: 'up',
    price: rnd(8, 220),
    pct: board === 'main' ? 10.0 : board === 'bse' ? 30.0 : 20.0,
    first_limit_time: t,
    last_limit_time: openTimes > 0 ? '14:52:00' : t,
    open_times: openTimes,
    turnover: rnd(2, 60) * 1e8,
    volume: Math.round(rnd(1, 30) * 1e6),
    circ_market_cap: rnd(50, 3000) * 1e8,
    total_market_cap: rnd(60, 4000) * 1e8,
    zt_count: zt,
    reason_raw: reason,
    tags: [
      { type: 'sector', id: industry, weight: 1 },
      ...tags.map((n, i) => ({ type: 'concept', id: n, weight: i === 0 ? 1 : 0.6 })),
    ],
  })),
  ...DOWN.map(([code, name, board, reason, tags, industry]) => ({
    stock_code: code,
    stock_name: name,
    board,
    limit_type: 'down',
    price: rnd(5, 90),
    pct: board === 'main' ? -10.0 : -20.0,
    first_limit_time: '09:31:00',
    last_limit_time: '15:00:00',
    open_times: 0,
    turnover: rnd(1, 15) * 1e8,
    volume: Math.round(rnd(0.5, 8) * 1e6),
    circ_market_cap: rnd(30, 400) * 1e8,
    total_market_cap: rnd(35, 500) * 1e8,
    zt_count: 1,
    reason_raw: reason,
    tags: [
      { type: 'sector', id: industry, weight: 1 },
      ...tags.map((n) => ({ type: 'concept', id: n, weight: 1 })),
    ],
  })),
]

const payload = { trade_date: TRADE_DATE, source: 'seed-demo', records }
const body = JSON.stringify(payload)
const sig = createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')

const res = await fetch(URL_, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-signature': sig },
  body,
})

const text = await res.text()
if (!res.ok) {
  console.error(`[seed-demo] HTTP ${res.status}:`, text)
  process.exit(1)
}
console.log(`[seed-demo] ${TRADE_DATE} →`, text)

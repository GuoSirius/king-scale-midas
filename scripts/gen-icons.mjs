#!/usr/bin/env node
/**
 * 金鳞·点石 品牌图标生成器
 *
 * 设计说明：
 *  - 主符号：金色鳞片弧线自下而上收拢成「上行三角」，轮廓本身即「涨」的语义；
 *    鳞 = 金鳞，三角 = 涨停板阶梯，底部横杠 = 板。
 *  - 点睛：右上角一枚星芒，取「点石成金」之意。
 *  - 小尺寸（<=48px）另用实心鳞片变体：细描边在 16px 下会糊成一团，
 *    实心半圆能在 16px 保留清晰轮廓，这是 favicon 能否被认出来的关键。
 *
 * 产物全部落在 public/，零外部依赖（仅用 node_modules 已有的 sharp + 内置 zlib）。
 * 用法：node scripts/gen-icons.mjs
 */
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')

/* ------------------------------------------------------------------ */
/* 设计常量                                                            */
/* ------------------------------------------------------------------ */
const GOLD_STOPS = `
    <stop offset="0%" stop-color="#FFF0C6"/>
    <stop offset="34%" stop-color="#F3C94F"/>
    <stop offset="70%" stop-color="#DC9F2C"/>
    <stop offset="100%" stop-color="#B57A1C"/>`

const INK_TOP = '#1B1B26'
const INK_BOTTOM = '#07070B'

/** 一片鳞：向上鼓起的半圆弧 */
const arc = (cx, cy, r) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

/** 一片实心鳞：闭合的半圆 */
const solidArc = (cx, cy, r) => `${arc(cx, cy, r)} Z`

/** 四芒星 */
const sparkle = (cx, cy, outer, inner) => [
  `M ${cx} ${cy - outer}`,
  `Q ${cx + inner * 0.35} ${cy - inner * 0.35} ${cx + inner} ${cy}`,
  `Q ${cx + inner * 0.35} ${cy + inner * 0.35} ${cx} ${cy + outer}`,
  `Q ${cx - inner * 0.35} ${cy + inner * 0.35} ${cx - inner} ${cy}`,
  `Q ${cx - inner * 0.35} ${cy - inner * 0.35} ${cx} ${cy - outer}`,
  'Z',
].join(' ')

/**
 * 完整徽标（适用于 >=64px）
 * @param {{ bleed?: boolean, scale?: number }} opts
 *   bleed  - true 时铺满画布不留圆角（apple-touch / maskable 需要不透明满幅）
 *   scale  - 主体缩放比例，maskable 需要缩到安全区内
 */
export function markFull({ bleed = false, scale = 1 } = {}) {
  const R = 46 // 鳞片半径
  const rows = [
    { y: 184, xs: [256] },
    { y: 252, xs: [216, 296] },
    { y: 320, xs: [176, 256, 336] },
    { y: 388, xs: [136, 216, 296, 376] },
  ]
  const scales = rows
    .flatMap(({ y, xs }) => xs.map(cx => `<path d="${arc(cx, y, R)}"/>`))
    .join('\n      ')

  const base = bleed
    ? `<rect width="512" height="512" fill="url(#ink)"/>`
    : `<rect width="512" height="512" rx="116" fill="url(#ink)"/>
  <rect x="7" y="7" width="498" height="498" rx="109" fill="none" stroke="#F3C94F" stroke-opacity="0.20" stroke-width="4"/>`

  const body = `
  <circle cx="256" cy="196" r="182" fill="url(#halo)"/>

  <g fill="none" stroke="url(#gold)" stroke-width="18" stroke-linecap="round">
      ${scales}
  </g>

  <path d="M 104 434 H 408" stroke="url(#gold)" stroke-opacity="0.42"
        stroke-width="9" stroke-linecap="round" fill="none"/>

  <g fill="url(#gold)">
    <path d="${sparkle(392, 138, 46, 13)}"/>
    <circle cx="132" cy="150" r="8" fill-opacity="0.75"/>
  </g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="金鳞·点石">
  <defs>
    <linearGradient id="gold" x1="0.08" y1="0" x2="0.92" y2="1">${GOLD_STOPS}
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${INK_TOP}"/>
      <stop offset="100%" stop-color="${INK_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#F3C94F" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#F3C94F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${base}
  <g transform="translate(${256 * (1 - scale)} ${256 * (1 - scale)}) scale(${scale})">${body}
  </g>
</svg>`
}

/**
 * 小尺寸徽标（<=48px）：实心鳞片，只留 2 行，保证 16px 下轮廓不糊
 */
export function markSmall({ bleed = false } = {}) {
  const R = 104
  const base = bleed
    ? `<rect width="512" height="512" fill="url(#ink)"/>`
    : `<rect width="512" height="512" rx="112" fill="url(#ink)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="gold" x1="0.08" y1="0" x2="0.92" y2="1">${GOLD_STOPS}
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${INK_TOP}"/>
      <stop offset="100%" stop-color="${INK_BOTTOM}"/>
    </linearGradient>
  </defs>
  ${base}
  <g fill="url(#gold)">
    <path d="${solidArc(256, 250, R)}"/>
    <g stroke="${INK_BOTTOM}" stroke-width="18" stroke-linejoin="round">
      <path d="${solidArc(150, 366, R)}"/>
      <path d="${solidArc(362, 366, R)}"/>
    </g>
  </g>
</svg>`
}

/* ------------------------------------------------------------------ */
/* ICO 封装：<=48 用 BMP(DIB)，>=64 用 PNG，兼容老 Windows 与全部浏览器 */
/* ------------------------------------------------------------------ */

/** RGBA 原始像素 -> ICO 内嵌的 BMP(DIB) 负载 */
function rgbaToDib(rgba, size) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight = XOR + AND
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // BI_RGB

  // XOR 位图：自下而上、BGRA
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4
    const dst = y * size * 4
    for (let x = 0; x < size; x++) {
      const s = src + x * 4
      const d = dst + x * 4
      xor[d] = rgba[s + 2]
      xor[d + 1] = rgba[s + 1]
      xor[d + 2] = rgba[s]
      xor[d + 3] = rgba[s + 3]
    }
  }

  // AND 掩码：1bpp，每行按 4 字节对齐；1 = 透明
  const rowBytes = Math.ceil(size / 32) * 4
  const and = Buffer.alloc(rowBytes * size)
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4
    for (let x = 0; x < size; x++) {
      if (rgba[src + x * 4 + 3] < 128) {
        and[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  return Buffer.concat([header, xor, and])
}

function buildIco(entries) {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2) // 1 = icon
  dir.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const table = []
  for (const e of entries) {
    const row = Buffer.alloc(16)
    row.writeUInt8(e.size >= 256 ? 0 : e.size, 0)
    row.writeUInt8(e.size >= 256 ? 0 : e.size, 1)
    row.writeUInt8(0, 2) // 调色板数
    row.writeUInt8(0, 3)
    row.writeUInt16LE(1, 4) // planes
    row.writeUInt16LE(32, 6) // bpp
    row.writeUInt32LE(e.data.length, 8)
    row.writeUInt32LE(offset, 12)
    table.push(row)
    offset += e.data.length
  }

  return Buffer.concat([dir, ...table, ...entries.map(e => e.data)])
}

/* ------------------------------------------------------------------ */

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size, { fit: 'contain' })

async function main() {
  await mkdir(PUBLIC, { recursive: true })

  const full = markFull()
  const fullBleed = markFull({ bleed: true })
  const maskable = markFull({ bleed: true, scale: 0.66 })
  const small = markSmall()

  const written = []
  const put = async (name, buf) => {
    await writeFile(resolve(PUBLIC, name), buf)
    written.push(`${name.padEnd(24)} ${String(buf.length).padStart(7)} B`)
  }

  // 1) 矢量主图标（现代浏览器优先取它）
  await put('favicon.svg', Buffer.from(full))

  // 2) PWA 图标
  await put('icon-192.png', await render(full, 192).png({ compressionLevel: 9 }).toBuffer())
  await put('icon-512.png', await render(full, 512).png({ compressionLevel: 9 }).toBuffer())
  await put(
    'maskable-512.png',
    await render(maskable, 512).png({ compressionLevel: 9 }).toBuffer(),
  )

  // 3) iOS 主屏图标：必须不透明、不带圆角（系统会自己切）
  await put(
    'apple-touch-icon.png',
    await render(fullBleed, 180).flatten({ background: INK_BOTTOM }).png({ compressionLevel: 9 }).toBuffer(),
  )

  // 4) favicon.ico：16/32/48 用实心变体 + BMP，64/128/256 用完整徽标 + PNG
  const icoEntries = []
  for (const size of [16, 32, 48]) {
    const { data } = await render(small, size).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    icoEntries.push({ size, data: rgbaToDib(data, size) })
  }
  for (const size of [64, 128, 256]) {
    const data = await render(full, size).png({ compressionLevel: 9 }).toBuffer()
    icoEntries.push({ size, data })
  }
  await put('favicon.ico', buildIco(icoEntries))

  // 5) 社交分享卡片
  await put('og-image.png', await sharp(Buffer.from(ogCard()), { density: 192 }).png({ compressionLevel: 9 }).toBuffer())

  console.log('已生成品牌图标：')
  for (const line of written) console.log('  ' + line)
}

/** 1200x630 分享卡片 */
function ogCard() {
  const mark = markFull()
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replace(/id="gold"/, 'id="gold2"')
    .replace(/id="ink"/g, 'id="ink2"')
    .replace(/id="halo"/, 'id="halo2"')
    .replace(/url\(#gold\)/g, 'url(#gold2)')
    .replace(/url\(#ink\)/g, 'url(#ink2)')
    .replace(/url\(#halo\)/g, 'url(#halo2)')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14141C"/>
      <stop offset="100%" stop-color="#06060A"/>
    </linearGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="1">${GOLD_STOPS}
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#page)"/>
  <g transform="translate(96 143) scale(0.673)">${mark}</g>
  <text x="440" y="286" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
        font-size="92" font-weight="700" fill="url(#txt)" letter-spacing="6">金鳞 · 点石</text>
  <text x="444" y="352" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
        font-size="34" fill="#9AA0AE" letter-spacing="2">A 股盘后涨跌停复盘</text>
  <path d="M 444 396 H 1032" stroke="#F3C94F" stroke-opacity="0.25" stroke-width="3"/>
  <text x="444" y="452" font-family="Consolas, Menlo, monospace"
        font-size="27" fill="#6B7280" letter-spacing="1">king-scale-midas</text>
</svg>`
}

// 仅在直接执行时生成文件，被 import 时只暴露设计函数（预览脚本会用到）
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

/**
 * 密码学与签名工具 —— 全部基于 Web Crypto（CF Workers / Node 24 原生可用）。
 * 不依赖 bcrypt / argon2（Workers 原生模块不可用），改用 PBKDF2-SHA256。
 */

const enc = new TextEncoder()

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

/** 生成随机 hex token */
export function randomToken(bytes = 32): string {
  return bufToHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer)
}

/** PBKDF2-SHA256 哈希密码，返回 "salt:hash" */
export async function hashPassword(password: string, iterations = 100_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return `${bufToHex(salt.buffer as ArrayBuffer)}:${bufToHex(bits)}`
}

/** 校验密码 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  return bufToHex(bits) === hashHex
}

/** SHA-256 hex */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return bufToHex(digest)
}

/** HMAC-SHA256 hex（采集器签名校验用） */
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bufToHex(sig)
}

/** 时间安全比较（防时序攻击） */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

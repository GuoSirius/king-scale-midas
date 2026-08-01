#!/usr/bin/env node
/**
 * 初始化本地 SQLite（A 备方案）：把 drizzle/*.sql 迁移全部应用到 .data/local.db。
 *
 * 幂等：已应用过的迁移会记录在 __local_migrations 表里，重复执行会跳过。
 * 用法：
 *   node scripts/local-db.mjs           # 增量应用
 *   node scripts/local-db.mjs --reset   # 删库重建
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = process.cwd()
const dataDir = resolve(root, '.data')
const dbPath = process.env.LOCAL_D1_PATH || join(dataDir, 'local.db')
const migDir = resolve(root, 'drizzle')
const reset = process.argv.includes('--reset')

if (reset && existsSync(dbPath)) {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix
    if (existsSync(p)) rmSync(p)
  }
  console.log('[local-db] 已删除旧库')
}

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS __local_migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`)

const applied = new Set(db.prepare('SELECT name FROM __local_migrations').all().map((r) => r.name))
const files = readdirSync(migDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

let total = 0
for (const file of files) {
  if (applied.has(file)) {
    console.log(`[local-db] skip  ${file}`)
    continue
  }
  const sql = readFileSync(join(migDir, file), 'utf8')
  const stmts = sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean)

  db.exec('BEGIN')
  try {
    for (const s of stmts) db.exec(s)
    db.prepare('INSERT INTO __local_migrations (name, applied_at) VALUES (?, ?)').run(file, Date.now())
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    console.error(`[local-db] FAILED ${file}:`, err.message)
    process.exit(1)
  }
  total += stmts.length
  console.log(`[local-db] apply ${file} (${stmts.length} statements)`)
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__local_migrations'")
  .all()
console.log(`[local-db] 完成：${dbPath}  共 ${tables.length} 张表，本次执行 ${total} 条语句`)
db.close()

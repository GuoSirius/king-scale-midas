/**
 * 本地 D1 兼容层 —— 用 Node 内置 node:sqlite 模拟 Cloudflare D1 的运行时接口。
 *
 * 存在的意义（对应需求「B主 + A备」）：
 *   B 主：线上跑在 Cloudflare Workers + 真 D1。
 *   A 备：本机拉下代码后，不装 wrangler、不连 Cloudflare、不需要 workerd 二进制，
 *         直接 `npm run dev:local` 就能把整站跑起来，数据落在 .data/local.db。
 *
 * 只实现 drizzle-orm/d1 driver 真正用到的子集：
 *   db.prepare(sql).bind(...params) -> { run(), all(), raw(), first() }
 *   db.batch([boundStmt, ...])
 *   db.exec(sql)
 * 注意：bind() 必须返回「新对象」而不是原地改写，
 *       因为 drizzle 会把同一个 stmt 复用于不同参数（session.js 里 this.stmt.bind(...)）。
 */

/** D1 只接受 null / number / bigint / string / ArrayBuffer，这里做一次入参归一化 */
function normalizeParam(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (v instanceof Uint8Array) return v
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

const normalize = (params) => params.map(normalizeParam)

/** 把 node:sqlite 返回的 null-prototype 对象转成普通对象，避免下游 spread / JSON 行为差异 */
const plain = (row) => (row == null ? row : { ...row })

class BoundStatement {
  constructor(db, sql, params) {
    this.db = db
    this.sql = sql
    this.params = normalize(params)
  }

  /** D1: 返回 { results, success, meta } */
  async all() {
    const stmt = this.db.prepare(this.sql)
    let results
    try {
      results = stmt.all(...this.params).map(plain)
    } catch (err) {
      // INSERT / UPDATE / DELETE 走 all() 时 node:sqlite 会直接执行并返回空集，
      // 少数语句（如 PRAGMA）例外，这里兜底成 run()
      const info = stmt.run(...this.params)
      return {
        results: [],
        success: true,
        meta: metaOf(info),
        error: undefined,
        _fallback: String(err?.message || err)
      }
    }
    return { results, success: true, meta: emptyMeta() }
  }

  /** D1: 返回二维数组（列值数组） */
  async raw() {
    const stmt = this.db.prepare(this.sql)
    stmt.setReturnArrays(true)
    return stmt.all(...this.params)
  }

  /** D1: 返回第一行；传 colName 时返回该列标量 */
  async first(colName) {
    const stmt = this.db.prepare(this.sql)
    const row = plain(stmt.get(...this.params))
    if (row === undefined || row === null) return null
    return colName === undefined ? row : row[colName]
  }

  /** D1: 返回 { results, success, meta } */
  async run() {
    const stmt = this.db.prepare(this.sql)
    const info = stmt.run(...this.params)
    return { results: [], success: true, meta: metaOf(info) }
  }
}

function emptyMeta() {
  return { duration: 0, rows_read: 0, rows_written: 0, changes: 0, last_row_id: 0, changed_db: false }
}

function metaOf(info) {
  const changes = Number(info?.changes ?? 0)
  return {
    duration: 0,
    rows_read: 0,
    rows_written: changes,
    changes,
    last_row_id: Number(info?.lastInsertRowid ?? 0),
    changed_db: changes > 0
  }
}

class UnboundStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
  }

  bind(...params) {
    return new BoundStatement(this.db, this.sql, params)
  }

  // 无参场景 drizzle 仍会 bind()，但保留直调能力更贴近 D1 真实行为
  all() {
    return new BoundStatement(this.db, this.sql, []).all()
  }

  raw() {
    return new BoundStatement(this.db, this.sql, []).raw()
  }

  first(colName) {
    return new BoundStatement(this.db, this.sql, []).first(colName)
  }

  run() {
    return new BoundStatement(this.db, this.sql, []).run()
  }
}

export class LocalD1Database {
  constructor(sqliteDb) {
    this.db = sqliteDb
  }

  prepare(sql) {
    return new UnboundStatement(this.db, sql)
  }

  /**
   * D1 的 batch 是「隐式事务」：全成功或全回滚。
   * node:sqlite 是同步 API，这里用显式事务包住即可。
   */
  async batch(statements) {
    this.db.exec('BEGIN')
    try {
      const out = []
      for (const stmt of statements) {
        out.push(await stmt.all())
      }
      this.db.exec('COMMIT')
      return out
    } catch (err) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* 忽略回滚失败 */
      }
      throw err
    }
  }

  async exec(sql) {
    this.db.exec(sql)
    return { count: 0, duration: 0 }
  }

  async dump() {
    throw new Error('LocalD1Database.dump() 未实现（本地开发不需要）')
  }
}

/** 打开（或创建）本地 SQLite 文件并返回 D1 兼容实例 */
export async function openLocalD1(filePath) {
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(filePath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  return new LocalD1Database(db)
}

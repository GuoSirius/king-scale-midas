import { defineConfig } from 'drizzle-kit'

// Drizzle Kit 仅负责「生成」迁移 SQL；应用迁移用 wrangler d1：
//   npm run db:migrate:local   (本地 .wrangler/state)
//   npm run db:migrate:remote  (Cloudflare 远程 D1)
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
})

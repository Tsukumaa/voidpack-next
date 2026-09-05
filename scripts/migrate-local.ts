import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

async function main() {
  await client.execute(`DROP TABLE IF EXISTS card_backs`)
  await client.execute(`
    CREATE TABLE card_backs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gradient TEXT DEFAULT '',
      pattern TEXT DEFAULT '',
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      price INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  console.log('card_backs OK')
}

main()

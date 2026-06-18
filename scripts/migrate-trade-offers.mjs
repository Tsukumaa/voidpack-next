import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url || !token) { console.error(`❌ Missing TURSO vars in ${envFile}`); return }

  const db = createClient({ url, authToken: token })

  // Make offered_card_id nullable by recreating table
  // First check if table exists
  const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='trade_offers'`)
  if (!tables.rows.length) {
    console.log(`⏭  ${envFile}: table trade_offers n'existe pas encore`)
    await db.close(); return
  }

  // Check if column already nullable (SQLite can't ALTER COLUMN, check pragma)
  const info = await db.execute(`PRAGMA table_info(trade_offers)`)
  const col = info.rows.find(r => r[1] === 'offered_card_id')
  if (col && col[3] === 0) {
    console.log(`⏭  ${envFile}: offered_card_id déjà nullable`)
    await db.close(); return
  }

  // Recreate table with offered_card_id nullable
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS trade_offers_new (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      offered_card_id TEXT,
      offered_card_key TEXT NOT NULL,
      offered_rarity TEXT NOT NULL,
      wanted_card_key TEXT NOT NULL,
      wanted_rarity TEXT,
      wanted_card_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      responded_at TEXT
    );
    INSERT INTO trade_offers_new SELECT * FROM trade_offers;
    DROP TABLE trade_offers;
    ALTER TABLE trade_offers_new RENAME TO trade_offers;
  `)

  console.log(`✅ ${envFile}: offered_card_id rendu nullable`)
  await db.close()
}

await migrate('.env.local')
await migrate('.env.prod')

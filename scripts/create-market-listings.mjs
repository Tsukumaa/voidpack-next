// Nouveau marché (vente de cartes contre du mana) : table market_listings.
// Ferme aussi les anciennes offres d'échange du marché (market_offers) encore ouvertes.
// Idempotent. Usage : node scripts/create-market-listings.mjs [.env.local|.env.prod]
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS market_listings (
    id          TEXT PRIMARY KEY,
    seller_id   TEXT NOT NULL,
    card_id     TEXT NOT NULL,
    rarity      TEXT NOT NULL,
    family      TEXT NOT NULL DEFAULT 'global',
    price       INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    buyer_id    TEXT,
    seller_gain INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL,
    closed_at   TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS market_listings_status_idx ON market_listings (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS market_listings_seller_idx ON market_listings (seller_id, status)`,
]

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url) { console.error(`❌ Missing TURSO_DATABASE_URL in ${envFile}`); return }

  const db = createClient({ url, authToken: token })
  for (const sql of STATEMENTS) await db.execute(sql)
  // Anciennes offres d'échange du marché : fermées (les échanges entre amis restent disponibles)
  const closed = await db.execute("UPDATE market_offers SET status = 'cancelled' WHERE status = 'open'").catch(() => ({ rowsAffected: 0 }))
  console.log(`✅ ${envFile}: market_listings OK${closed.rowsAffected ? ` · ${closed.rowsAffected} ancienne(s) offre(s) d'échange fermée(s)` : ''}`)
  db.close()
}

const files = process.argv.slice(2)
for (const f of files.length ? files : ['.env.local']) await migrate(f)

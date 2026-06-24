import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url) { console.error('TURSO_DATABASE_URL manquant'); process.exit(1) }

const db = createClient({ url, authToken })

// Colonnes ajoutées à player_profiles (ALTER TABLE ADD COLUMN, idempotent via try/catch)
const cols = [
  ['email', 'TEXT'],
  ['kofi_email', 'TEXT'],
  ['is_subscriber', 'INTEGER NOT NULL DEFAULT 0'],
  ['subscriber_until', 'TEXT'],
]
for (const [name, type] of cols) {
  try {
    await db.execute(`ALTER TABLE player_profiles ADD COLUMN ${name} ${type}`)
    console.log(`+ colonne ${name}`)
  } catch (e) {
    if (/duplicate column/i.test(e.message)) console.log(`= colonne ${name} existe déjà`)
    else throw e
  }
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS kofi_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id  TEXT UNIQUE,
    type            TEXT,
    email           TEXT,
    tier_name       TEXT,
    amount          TEXT,
    is_subscription INTEGER NOT NULL DEFAULT 0,
    matched_user_id TEXT,
    processed       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
console.log('✅ kofi_events OK')

import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url) { console.error('TURSO_DATABASE_URL manquant'); process.exit(1) }

const db = createClient({ url, authToken })

await db.execute(`
  CREATE TABLE IF NOT EXISTS twitch_streamers (
    broadcaster_id    TEXT PRIMARY KEY,
    broadcaster_login TEXT NOT NULL,
    user_id           TEXT,
    access_token      TEXT,
    refresh_token     TEXT,
    scope             TEXT,
    active            INTEGER NOT NULL DEFAULT 1,
    subscription_id   TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS twitch_rewards (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcaster_id TEXT NOT NULL,
    reward_id      TEXT NOT NULL,
    reward_title   TEXT,
    reward_cost    INTEGER,
    booster_type   TEXT,
    quantity       INTEGER NOT NULL DEFAULT 1,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

await db.execute(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_twitch_rewards_unique
  ON twitch_rewards (broadcaster_id, reward_id)
`)

const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'twitch_%'`)
console.log('Tables twitch présentes:', tables.rows.map(r => r.name).join(', '))
console.log('✅ Terminé')

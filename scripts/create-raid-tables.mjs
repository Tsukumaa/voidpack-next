// Crée les tables du système de raids. Idempotent (IF NOT EXISTS).
// Usage : node scripts/create-raid-tables.mjs [.env.local|.env.prod]
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS raids (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    description      TEXT,
    objective_type   TEXT NOT NULL,
    goal             INTEGER NOT NULL,
    progress         INTEGER NOT NULL DEFAULT 0,
    min_contribution INTEGER NOT NULL DEFAULT 1,
    tiers            TEXT NOT NULL DEFAULT '[]',
    status           TEXT NOT NULL DEFAULT 'active',
    ends_at          TEXT,
    completed_at     TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS raids_status_idx ON raids (status)`,
  `CREATE TABLE IF NOT EXISTS raid_contributions (
    raid_id    INTEGER NOT NULL,
    user_id    TEXT NOT NULL,
    amount     INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (raid_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS raid_claims (
    raid_id    INTEGER NOT NULL,
    user_id    TEXT NOT NULL,
    tier       INTEGER NOT NULL,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (raid_id, user_id, tier)
  )`,
]

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url) { console.error(`❌ Missing TURSO_DATABASE_URL in ${envFile}`); return }

  const db = createClient({ url, authToken: token })
  for (const sql of STATEMENTS) await db.execute(sql)
  // Tables créées avant l'ajout de completed_at
  const cols = (await db.execute('PRAGMA table_info(raids)')).rows.map(r => r.name)
  if (!cols.includes('completed_at')) await db.execute('ALTER TABLE raids ADD COLUMN completed_at TEXT')
  // Raids en cours dont l'objectif est déjà atteint : la fenêtre de réclamation démarre maintenant
  await db.execute(`UPDATE raids SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), progress = goal
    WHERE status = 'active' AND completed_at IS NULL AND progress >= goal`)
  console.log(`✅ ${envFile}: tables raids, raid_contributions, raid_claims OK`)
  db.close()
}

const files = process.argv.slice(2)
for (const f of files.length ? files : ['.env.local']) await migrate(f)

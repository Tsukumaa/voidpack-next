// Ajoute les index manquants sur les tables interrogées par /api/social/activity,
// /api/social/friends et /api/social/messages. Idempotent (IF NOT EXISTS).
// Usage : node scripts/add-social-indexes.mjs [.env.local|.env.prod]
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS direct_messages_receiver_read_idx   ON direct_messages (receiver_id, read_at)`,
  `CREATE INDEX IF NOT EXISTS direct_messages_sender_receiver_idx ON direct_messages (sender_id, receiver_id)`,
  `CREATE INDEX IF NOT EXISTS friendships_receiver_status_idx     ON friendships (receiver_id, status)`,
  `CREATE INDEX IF NOT EXISTS game_sessions_status_idx            ON game_sessions (status)`,
  `CREATE INDEX IF NOT EXISTS trade_offers_receiver_status_idx    ON trade_offers (receiver_id, status)`,
  `CREATE INDEX IF NOT EXISTS trade_offers_sender_idx             ON trade_offers (sender_id)`,
]

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url) { console.error(`❌ Missing TURSO_DATABASE_URL in ${envFile}`); return }

  const db = createClient({ url, authToken: token })
  for (const sql of INDEXES) {
    await db.execute(sql)
    console.log(`✅ ${envFile}: ${sql.match(/EXISTS (\S+)/)[1]}`)
  }
  // Met à jour les statistiques du planificateur pour qu'il choisisse les nouveaux index
  await db.execute('ANALYZE')
  console.log(`✅ ${envFile}: ANALYZE`)
  db.close()
}

const files = process.argv.slice(2)
for (const f of files.length ? files : ['.env.local']) await migrate(f)

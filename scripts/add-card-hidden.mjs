// Ajoute la colonne custom_cards.hidden (cartes masquées côté joueurs). Idempotent.
// Usage : node scripts/add-card-hidden.mjs [.env.local|.env.prod]
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url) { console.error(`❌ Missing TURSO_DATABASE_URL in ${envFile}`); return }

  const db = createClient({ url, authToken: token })
  const cols = (await db.execute('PRAGMA table_info(custom_cards)')).rows.map(r => r.name)
  if (cols.includes('hidden')) {
    console.log(`⏭  ${envFile}: custom_cards.hidden existe déjà`)
  } else {
    await db.execute('ALTER TABLE custom_cards ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0')
    console.log(`✅ ${envFile}: custom_cards.hidden ajoutée`)
  }
  db.close()
}

const files = process.argv.slice(2)
for (const f of files.length ? files : ['.env.local']) await migrate(f)

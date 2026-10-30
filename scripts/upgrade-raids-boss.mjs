// Passage des raids au système de boss + cartes exclusives. Idempotent.
// Usage : node scripts/upgrade-raids-boss.mjs [.env.local|.env.prod]
// Prérequis : tables raids créées (scripts/create-raid-tables.mjs)
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const COLUMNS = {
  raids: [
    ['boss_image_url', 'TEXT'],
    ['promo_card_id',  'TEXT'],
    ['config',         "TEXT NOT NULL DEFAULT '{}'"],
    ['finalized_at',   'TEXT'],
  ],
  raid_contributions: [
    ['missions',      'INTEGER NOT NULL DEFAULT 0'],
    ['rank',          'INTEGER'],
    ['mana_reward',   'INTEGER'],
    ['promo_granted', 'INTEGER NOT NULL DEFAULT 0'],
    ['mission_days',     'INTEGER NOT NULL DEFAULT 0'], // jours distincts avec ≥ 1 mission réclamée
    ['last_mission_day', 'TEXT'],                       // dernier jour compté (YYYY-MM-DD, UTC)
  ],
  custom_cards: [
    ['exclusive', 'INTEGER NOT NULL DEFAULT 0'],
  ],
}

async function migrate(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url   = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url) { console.error(`❌ Missing TURSO_DATABASE_URL in ${envFile}`); return }

  const db = createClient({ url, authToken: token })
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const existing = (await db.execute(`PRAGMA table_info(${table})`)).rows.map(r => r.name)
    for (const [name, type] of cols) {
      if (existing.includes(name)) continue
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
      console.log(`✅ ${envFile}: ${table}.${name}`)
    }
  }
  await db.execute('CREATE INDEX IF NOT EXISTS raid_contributions_damage_idx ON raid_contributions (raid_id, amount)')
  // Reprise : participations avec missions mais sans jour compté → 1 jour (celui de la dernière action)
  const backfill = await db.execute(`UPDATE raid_contributions SET mission_days = 1, last_mission_day = substr(updated_at, 1, 10)
    WHERE missions > 0 AND mission_days = 0`)
  if (backfill.rowsAffected) console.log(`↺  ${envFile}: ${backfill.rowsAffected} participation(s) reprise(s) à 1 jour de mission`)
  // Les raids de l'ancien système (jauge à paliers) sont clôturés
  const closed = await db.execute("UPDATE raids SET status = 'ended' WHERE objective_type != 'boss' AND status != 'ended'")
  if (closed.rowsAffected) console.log(`⏹  ${envFile}: ${closed.rowsAffected} ancien(s) raid(s) clôturé(s)`)
  console.log(`✅ ${envFile}: raids boss OK`)
  db.close()
}

const files = process.argv.slice(2)
for (const f of files.length ? files : ['.env.local']) await migrate(f)

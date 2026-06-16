/**
 * Migration : consolide player_cards en une ligne par carte avec un compteur.
 *
 * Usage:
 *   npx dotenv -e .env.local -- node scripts/migrate-cards-count.mjs   # dev
 *   npx dotenv -e .env.prod  -- node scripts/migrate-cards-count.mjs   # prod
 */

import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env
if (!TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL manquant')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

console.log(`\nMigration → ${TURSO_DATABASE_URL}\n`)

// 1. Créer la nouvelle table
await client.execute(`
  CREATE TABLE IF NOT EXISTS player_cards_new (
    user_id          TEXT NOT NULL,
    card_id          TEXT NOT NULL,
    rarity           TEXT NOT NULL,
    family           TEXT NOT NULL DEFAULT 'global',
    count            INTEGER NOT NULL DEFAULT 1,
    first_obtained_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_obtained_at  TEXT NOT NULL DEFAULT (datetime('now')),
    metadata         TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (user_id, card_id)
  )
`)
console.log('  ✓ Table player_cards_new créée')

// 2. Migrer les données en consolidant les doublons
await client.execute(`
  INSERT OR IGNORE INTO player_cards_new
    (user_id, card_id, rarity, family, count, first_obtained_at, last_obtained_at, metadata)
  SELECT
    user_id,
    card_id,
    rarity,
    family,
    COUNT(*) as count,
    MIN(obtained_at) as first_obtained_at,
    MAX(obtained_at) as last_obtained_at,
    metadata
  FROM player_cards
  GROUP BY user_id, card_id
`)
const result = await client.execute(`SELECT COUNT(*) as n FROM player_cards_new`)
console.log(`  ✓ ${result.rows[0].n} lignes consolidées`)

// 3. Remplacer l'ancienne table
await client.execute(`DROP TABLE player_cards`)
await client.execute(`ALTER TABLE player_cards_new RENAME TO player_cards`)
await client.execute(`CREATE INDEX IF NOT EXISTS player_cards_user_id_idx ON player_cards(user_id)`)
console.log('  ✓ Table remplacée + index recréé')

console.log('\nMigration terminée.\n')
client.close()

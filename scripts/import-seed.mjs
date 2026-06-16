/**
 * Import a seed JSON file exported from the admin panel into a Turso DB.
 *
 * Usage:
 *   node scripts/import-seed.mjs voidpack-seed-2026-06-16.json
 *
 * The script reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the env.
 * Use dotenv-cli to target a specific DB:
 *   npx dotenv -e .env.local -- node scripts/import-seed.mjs seed.json   # dev
 *   npx dotenv -e .env.prod  -- node scripts/import-seed.mjs seed.json   # prod
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/import-seed.mjs <seed.json>')
  process.exit(1)
}

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env
if (!TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL manquant — utilise dotenv-cli pour cibler la bonne DB.')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
const seed = JSON.parse(readFileSync(resolve(file), 'utf-8'))

function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

async function upsert(table, rows, conflictCol) {
  if (!rows?.length) return
  let ok = 0
  for (const row of rows) {
    const cols = Object.keys(row).join(', ')
    const vals = Object.values(row).map(esc).join(', ')
    const updates = Object.entries(row)
      .filter(([k]) => k !== conflictCol)
      .map(([k, v]) => `${k}=${esc(v)}`)
      .join(', ')
    await client.execute(`INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT(${conflictCol}) DO UPDATE SET ${updates}`)
    ok++
  }
  console.log(`  ✓ ${table}: ${ok} lignes importées`)
}

console.log(`\nImport → ${TURSO_DATABASE_URL}\n`)

await upsert('families',     seed.families,    'key')
await upsert('custom_cards', seed.custom_cards, 'id')
await upsert('card_backs',   seed.card_backs,   'id')

// settings : upsert sur key
if (seed.settings?.length) {
  let ok = 0
  for (const row of seed.settings) {
    await client.execute(`INSERT INTO settings (key, value) VALUES (${esc(row.key)}, ${esc(row.value)}) ON CONFLICT(key) DO UPDATE SET value=${esc(row.value)}`)
    ok++
  }
  console.log(`  ✓ settings: ${ok} lignes importées`)
}

console.log('\nImport terminé.\n')
client.close()

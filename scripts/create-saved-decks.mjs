import { createClient } from '@libsql/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.prod') })

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await client.execute(`
  CREATE TABLE IF NOT EXISTS saved_decks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    cards       TEXT NOT NULL DEFAULT '[]',
    total_cards INTEGER NOT NULL DEFAULT 0,
    total_mana  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

console.log('✅ Table saved_decks créée')
client.close()

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Arène par défaut = bg-void (gratuite, sélectionnée d'office)
const DEFAULT = {
  id: 'default',
  name: 'Néant VOID',
  image_url: '/assets/bg-void.png',
  gradient: 'linear-gradient(180deg, #050210 0%, #08031a 50%, #050210 100%)',
  active: 1,
  order_index: 0,
  price: 0,
}

async function setup(envFile) {
  let env
  try { env = readFileSync(resolve(process.cwd(), envFile), 'utf8') }
  catch { console.log(`⏭  ${envFile} introuvable, ignoré`); return }

  const url = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url || !token) { console.error(`❌ Variables TURSO manquantes dans ${envFile}`); return }

  const db = createClient({ url, authToken: token })

  await db.execute(`
    CREATE TABLE IF NOT EXISTS arena_backgrounds (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      image_url   TEXT,
      gradient    TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      price       INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  console.log(`✅ ${envFile}: table arena_backgrounds prête`)

  const existing = await db.execute(`SELECT id FROM arena_backgrounds WHERE id = 'default'`)
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO arena_backgrounds (id, name, image_url, gradient, active, order_index, price)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT.id, DEFAULT.name, DEFAULT.image_url, DEFAULT.gradient, DEFAULT.active, DEFAULT.order_index, DEFAULT.price],
    })
    console.log(`✅ ${envFile}: arène "Néant VOID" insérée`)
  } else {
    console.log(`⏭  ${envFile}: arène "default" existe déjà`)
  }

  await db.close()
}

await setup('.env.local')
await setup('.env.prod')

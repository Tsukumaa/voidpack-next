import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const DEFAULT = {
  id: 'default',
  name: 'VOID Pack',
  gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
  pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
  image_url: null,
  active: 1,
  order_index: 0,
  price: 0,
}

async function seed(envFile) {
  const env = readFileSync(resolve(process.cwd(), envFile), 'utf8')
  const url = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim()
  const token = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim()
  if (!url || !token) { console.error(`❌ Missing TURSO vars in ${envFile}`); return }

  const db = createClient({ url, authToken: token })

  const existing = await db.execute(`SELECT id FROM card_backs WHERE id = 'default'`)
  if (existing.rows.length > 0) {
    console.log(`⏭  ${envFile}: dos "default" existe déjà`)
    await db.close()
    return
  }

  await db.execute({
    sql: `INSERT INTO card_backs (id, name, gradient, pattern, image_url, active, order_index, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [DEFAULT.id, DEFAULT.name, DEFAULT.gradient, DEFAULT.pattern, DEFAULT.image_url, DEFAULT.active, DEFAULT.order_index, DEFAULT.price],
  })
  console.log(`✅ ${envFile}: dos "VOID Pack" inséré`)
  await db.close()
}

await seed('.env.local')
await seed('.env.prod')

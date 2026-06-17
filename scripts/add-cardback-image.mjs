import { createClient } from '@libsql/client'

const url   = process.env.TURSO_DATABASE_URL
const token = process.env.TURSO_AUTH_TOKEN

if (!url || !token) { console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN'); process.exit(1) }

const db = createClient({ url, authToken: token })

try {
  await db.execute(`ALTER TABLE card_backs ADD COLUMN image_url TEXT`)
  console.log('✅ Column image_url added to card_backs')
} catch (e) {
  if (e.message?.includes('duplicate column')) {
    console.log('ℹ Column image_url already exists')
  } else {
    throw e
  }
}

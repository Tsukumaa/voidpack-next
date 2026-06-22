import { createClient } from '@libsql/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.prod') })

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const result = await client.execute(`
  UPDATE game_sessions
  SET status = 'finished', finished_at = datetime('now'), updated_at = datetime('now')
  WHERE status = 'active'
`)

console.log(`✅ ${result.rowsAffected} session(s) marquées finished`)
client.close()

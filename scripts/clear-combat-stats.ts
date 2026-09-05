import 'dotenv/config'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { combatStats } from '../src/lib/db/schema'

const db = drizzle(createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
}))

async function main() {
  await db.delete(combatStats)
  console.log('combat_stats cleared')
}

main()

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../src/lib/db/schema'

const db = drizzle(createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
}), { schema })

async function main() {
  const rows = await db.select().from(schema.cardBacks)
  console.log('card_backs:', JSON.stringify(rows, null, 2))
}
main()

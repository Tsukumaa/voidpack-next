import 'dotenv/config'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { ne } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const db = drizzle(createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
}), { schema })

async function main() {
  // Tous les dos sauf le commun (id = 'dos-de-carte-commun') passent à price=1 (abonné requis)
  const rows = await db.select({ id: schema.cardBacks.id, name: schema.cardBacks.name, price: schema.cardBacks.price }).from(schema.cardBacks)
  console.log('Avant:', rows)

  await db.update(schema.cardBacks)
    .set({ price: 1 })
    .where(ne(schema.cardBacks.id, 'dos-de-carte-commun'))

  const after = await db.select({ id: schema.cardBacks.id, name: schema.cardBacks.name, price: schema.cardBacks.price }).from(schema.cardBacks)
  console.log('Après:', after)
}

main()

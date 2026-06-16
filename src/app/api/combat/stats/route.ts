import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { combatStats } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const stats = await db.query.combatStats.findFirst({
    where: eq(combatStats.userId, session.user.id),
  })
  return NextResponse.json(stats ?? null)
}

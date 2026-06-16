import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCredits } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const credits = await db.query.boosterCredits.findMany({
    where: and(
      eq(boosterCredits.userId, session.user.id),
      eq(boosterCredits.claimed, false)
    ),
  })
  return NextResponse.json(credits)
}

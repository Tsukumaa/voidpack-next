import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db
    .update(playerProfiles)
    .set({ twitchId: null, twitchLogin: null, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, session.user.id))

  return NextResponse.json({ ok: true })
}

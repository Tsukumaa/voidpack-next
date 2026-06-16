import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { twitch_id, twitch_login } = await req.json()
  if (!twitch_id || !twitch_login) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  await db
    .update(playerProfiles)
    .set({ twitchId: twitch_id, twitchLogin: twitch_login, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, session.user.id))

  return NextResponse.json({ ok: true, twitch_login })
}

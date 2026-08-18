import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { message } = await req.json()
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return NextResponse.json({ error: 'Message trop court' }, { status: 400 })
  }

  const [profile] = await db.select({ isBanned: playerProfiles.isBanned, banAppeal: playerProfiles.banAppeal })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, session.user.id))
    .limit(1)

  if (!profile?.isBanned) return NextResponse.json({ error: 'Compte non banni' }, { status: 400 })
  if (profile.banAppeal) return NextResponse.json({ error: 'Demande déjà envoyée' }, { status: 409 })

  await db.update(playerProfiles)
    .set({ banAppeal: message.trim().slice(0, 1000), updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, session.user.id))

  return NextResponse.json({ ok: true })
}

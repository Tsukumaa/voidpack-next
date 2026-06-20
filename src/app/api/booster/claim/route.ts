import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCredits, playerProfiles } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = session.user.id
  const { id } = await req.json()

  const [credit] = await db
    .update(boosterCredits)
    .set({ claimed: true, claimedAt: new Date().toISOString() })
    .where(and(
      eq(boosterCredits.id, id),
      eq(boosterCredits.userId, uid),
      eq(boosterCredits.claimed, false)
    ))
    .returning()

  if (!credit) return NextResponse.json({ error: 'Credit not found or already claimed' }, { status: 404 })

  // Incrémenter packs_opened sur le profil
  await db
    .update(playerProfiles)
    .set({
      packsOpened: sql`${playerProfiles.packsOpened} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(playerProfiles.userId, uid))

  // Retourner le nouveau total pour que le client puisse vérifier les succès
  const profile = await db.query.playerProfiles.findFirst({ where: eq(playerProfiles.userId, uid) })

  return NextResponse.json({ ok: true, packs_opened: profile?.packsOpened ?? 1 })
}

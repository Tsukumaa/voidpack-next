import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCredits, friendships } from '@/lib/db/schema'
import { eq, and, or, count, gte } from 'drizzle-orm'

const DAILY_GIFT_QUOTA = 10

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { friendId, boosterType, creditId } = await req.json()
  if (!friendId || !boosterType || !creditId) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  if (friendId === userId) return NextResponse.json({ error: 'Tu ne peux pas te gifter toi-même' }, { status: 400 })

  // Vérifier que les deux sont amis
  const friendship = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'accepted'),
      or(
        and(eq(friendships.senderId, userId), eq(friendships.receiverId, friendId)),
        and(eq(friendships.senderId, friendId), eq(friendships.receiverId, userId)),
      )
    ),
  })
  if (!friendship) return NextResponse.json({ error: 'Cet utilisateur n\'est pas ton ami' }, { status: 403 })

  // Vérifier le quota journalier (10 dons/jour toutes cibles confondues)
  const today = new Date().toISOString().split('T')[0]
  const [{ gifted }] = await db
    .select({ gifted: count() })
    .from(boosterCredits)
    .where(and(
      eq(boosterCredits.giftedFrom, userId),
      gte(boosterCredits.createdAt, today),
    ))
  if (gifted >= DAILY_GIFT_QUOTA) {
    return NextResponse.json({ error: `Quota journalier atteint (${DAILY_GIFT_QUOTA} boosters/jour)` }, { status: 409 })
  }

  // Vérifier que le crédit appartient au sender et n'est pas encore utilisé
  const credit = await db.query.boosterCredits.findFirst({
    where: and(
      eq(boosterCredits.id, creditId),
      eq(boosterCredits.userId, userId),
      eq(boosterCredits.boosterType, boosterType),
      eq(boosterCredits.claimed, false),
    ),
  })
  if (!credit) return NextResponse.json({ error: 'Crédit introuvable ou déjà utilisé' }, { status: 404 })

  const now = new Date().toISOString()

  await db.update(boosterCredits)
    .set({ claimed: true, claimedAt: now })
    .where(eq(boosterCredits.id, creditId))

  await db.insert(boosterCredits).values({
    userId:      friendId,
    boosterType: credit.boosterType,
    source:      'gift',
    giftedFrom:  userId,
    createdAt:   now,
  })

  return NextResponse.json({ ok: true, remaining: DAILY_GIFT_QUOTA - gifted - 1 })
}

// Quota journalier restant
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ used: 0, remaining: DAILY_GIFT_QUOTA }, { status: 401 })

  const userId = session.user.id
  const today = new Date().toISOString().split('T')[0]

  const [{ used }] = await db
    .select({ used: count() })
    .from(boosterCredits)
    .where(and(
      eq(boosterCredits.giftedFrom, userId),
      gte(boosterCredits.createdAt, today),
    ))

  return NextResponse.json({ used, remaining: DAILY_GIFT_QUOTA - used })
}

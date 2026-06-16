import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { boosterCodes, boosterCodeRedemptions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Connecte-toi avec Discord pour utiliser un code booster.' }, { status: 401 })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code manquant.' }, { status: 400 })

  const uid = session.user.id

  const boosterCode = await db.query.boosterCodes.findFirst({
    where: eq(boosterCodes.code, code),
  })

  if (!boosterCode) {
    return NextResponse.json({ error: 'Code introuvable ou invalide.' }, { status: 404 })
  }

  if (boosterCode.status !== 'active') {
    return NextResponse.json({ error: 'Ce code est désactivé.' }, { status: 400 })
  }

  if (boosterCode.expiresAt && new Date(boosterCode.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Ce code a expiré.' }, { status: 400 })
  }

  if (boosterCode.redeemedCount >= boosterCode.maxRedemptions) {
    return NextResponse.json({ error: 'Ce code a déjà été utilisé le nombre maximum de fois.' }, { status: 400 })
  }

  const existing = await db.query.boosterCodeRedemptions.findFirst({
    where: and(
      eq(boosterCodeRedemptions.codeId, boosterCode.id),
      eq(boosterCodeRedemptions.userId, uid),
    ),
  })

  if (existing) {
    return NextResponse.json({ error: 'Tu as déjà utilisé ce code.' }, { status: 400 })
  }

  const redemptionId = crypto.randomUUID()

  await db.insert(boosterCodeRedemptions).values({
    id:     redemptionId,
    codeId: boosterCode.id,
    userId: uid,
    status: 'pending',
  })

  await db.update(boosterCodes)
    .set({ redeemedCount: sql`${boosterCodes.redeemedCount} + 1` })
    .where(eq(boosterCodes.id, boosterCode.id))

  return NextResponse.json({
    redemptionId,
    codeId:               boosterCode.id,
    boosterType:          boosterCode.boosterType,
    normalizedCode:       boosterCode.code,
    userId:               uid,
    redeemedAt:           new Date().toISOString(),
    remainingRedemptions: boosterCode.maxRedemptions - boosterCode.redeemedCount - 1,
    metadata:             JSON.parse(boosterCode.metadata ?? '{}'),
  })
}

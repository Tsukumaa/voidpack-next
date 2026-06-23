import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { twitchStreamers, twitchRewards, boosterCredits, playerProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'crypto'
import { EVENTSUB_SECRET, REDEMPTION_EVENT } from '@/lib/twitch/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vérifie la signature HMAC-SHA256 du message EventSub
function verifySignature(req: NextRequest, body: string): boolean {
  const msgId        = req.headers.get('Twitch-Eventsub-Message-Id') ?? ''
  const msgTimestamp = req.headers.get('Twitch-Eventsub-Message-Timestamp') ?? ''
  const signature    = req.headers.get('Twitch-Eventsub-Message-Signature') ?? ''
  if (!signature.startsWith('sha256=') || !EVENTSUB_SECRET) return false

  const hmac = 'sha256=' + createHmac('sha256', EVENTSUB_SECRET)
    .update(msgId + msgTimestamp + body)
    .digest('hex')

  const a = Buffer.from(hmac)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySignature(req, body)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 })
  }

  const messageType = req.headers.get('Twitch-Eventsub-Message-Type')
  let payload: {
    challenge?: string
    subscription?: { type?: string; condition?: { broadcaster_user_id?: string } }
    event?: {
      id?: string
      broadcaster_user_id?: string
      user_id?: string
      user_login?: string
      reward?: { id?: string; title?: string; cost?: number }
    }
  }
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // 1. Challenge de vérification d'abonnement
  if (messageType === 'webhook_callback_verification') {
    return new NextResponse(payload.challenge ?? '', {
      status: 200, headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 2. Révocation d'abonnement
  if (messageType === 'revocation') {
    console.warn('EventSub revoked:', payload.subscription)
    return NextResponse.json({ ok: true })
  }

  // 3. Notification réelle
  if (messageType === 'notification' && payload.subscription?.type === REDEMPTION_EVENT) {
    const event = payload.event
    const broadcasterId = event?.broadcaster_user_id
    const rewardId      = event?.reward?.id
    const redemptionId  = event?.id
    const twitchUserId  = event?.user_id

    if (!broadcasterId || !rewardId || !redemptionId) {
      return NextResponse.json({ ok: true, ignored: 'missing_fields' })
    }

    // Le broadcaster doit être connu et actif
    const streamer = await db.query.twitchStreamers.findFirst({
      where: and(eq(twitchStreamers.broadcasterId, broadcasterId), eq(twitchStreamers.active, true)),
    })
    if (!streamer) return NextResponse.json({ ok: true, ignored: 'unknown_streamer' })

    // Cherche le mapping reward → booster
    const reward = await db.query.twitchRewards.findFirst({
      where: and(eq(twitchRewards.broadcasterId, broadcasterId), eq(twitchRewards.rewardId, rewardId)),
    })

    // Reward inconnu → on l'enregistre pour mapping ultérieur dans l'admin, sans créditer
    if (!reward) {
      await db.insert(twitchRewards).values({
        broadcasterId,
        rewardId,
        rewardTitle: event?.reward?.title ?? null,
        rewardCost:  event?.reward?.cost ?? null,
        boosterType: null,
        active: true,
      }).onConflictDoNothing()
      return NextResponse.json({ ok: true, discovered: rewardId })
    }

    // Reward connu mais non mappé ou désactivé → on ne crédite pas
    if (!reward.boosterType || !reward.active) {
      return NextResponse.json({ ok: true, ignored: 'unmapped_or_inactive' })
    }

    // Trouve le joueur VOID via son twitch_id
    const player = await db.query.playerProfiles.findFirst({
      where: eq(playerProfiles.twitchId, twitchUserId ?? '___none___'),
    })
    if (!player) {
      // Joueur pas encore lié — on log mais on accuse réception (sinon Twitch renvoie)
      console.warn('Twitch redemption sans joueur lié:', twitchUserId)
      return NextResponse.json({ ok: true, ignored: 'player_not_linked' })
    }

    // Crédite le(s) booster(s). sourceRef unique → déduplication automatique.
    const qty = reward.quantity ?? 1
    const rows = Array.from({ length: qty }, (_, i) => ({
      userId:      player.userId,
      boosterType: reward.boosterType as string,
      source:      'twitch',
      sourceRef:   qty > 1 ? `${redemptionId}:${i}` : redemptionId,
      createdBy:   broadcasterId,
    }))

    try {
      await db.insert(boosterCredits).values(rows).onConflictDoNothing()
    } catch (e) {
      console.error('credit booster (twitch) error:', e)
      return NextResponse.json({ ok: true, error: 'credit_failed' })
    }

    return NextResponse.json({ ok: true, credited: reward.boosterType, qty })
  }

  return NextResponse.json({ ok: true })
}

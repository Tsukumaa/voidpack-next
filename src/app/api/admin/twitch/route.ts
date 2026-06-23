import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { twitchStreamers, twitchRewards } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { deleteSubscription, subscribeRedemptions } from '@/lib/twitch/api'

export const dynamic = 'force-dynamic'

// GET — liste les streamers connectés + leurs rewards mappés
export async function GET() {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const streamers = await db.select({
    broadcasterId:    twitchStreamers.broadcasterId,
    broadcasterLogin: twitchStreamers.broadcasterLogin,
    userId:           twitchStreamers.userId,
    active:           twitchStreamers.active,
    subscriptionId:   twitchStreamers.subscriptionId,
    createdAt:        twitchStreamers.createdAt,
  }).from(twitchStreamers).orderBy(desc(twitchStreamers.createdAt))

  const rewards = await db.select().from(twitchRewards).orderBy(desc(twitchRewards.createdAt))

  return NextResponse.json({ streamers, rewards })
}

// POST — actions de gestion
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, data } = await req.json() as { action: string; data: Record<string, unknown> }

  // Mappe un reward → type de booster
  if (action === 'map_reward') {
    const { id, boosterType, quantity, active } = data as
      { id: number; boosterType: string | null; quantity?: number; active?: boolean }
    await db.update(twitchRewards).set({
      boosterType: boosterType || null,
      quantity:    quantity && quantity > 0 ? quantity : 1,
      active:      active ?? true,
      updatedAt:   new Date().toISOString(),
    }).where(eq(twitchRewards.id, id))
    return NextResponse.json({ ok: true })
  }

  // Ajoute manuellement un reward (pré-mapping avant la première utilisation)
  if (action === 'add_reward') {
    const { broadcasterId, rewardId, rewardTitle, boosterType, quantity } = data as
      { broadcasterId: string; rewardId: string; rewardTitle?: string; boosterType?: string; quantity?: number }
    if (!broadcasterId || !rewardId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    await db.insert(twitchRewards).values({
      broadcasterId, rewardId,
      rewardTitle: rewardTitle ?? null,
      boosterType: boosterType || null,
      quantity:    quantity && quantity > 0 ? quantity : 1,
      active: true,
    }).onConflictDoUpdate({
      target: [twitchRewards.broadcasterId, twitchRewards.rewardId],
      set: { rewardTitle: rewardTitle ?? null, boosterType: boosterType || null, updatedAt: new Date().toISOString() },
    })
    return NextResponse.json({ ok: true })
  }

  // Supprime un reward
  if (action === 'delete_reward') {
    const { id } = data as { id: number }
    await db.delete(twitchRewards).where(eq(twitchRewards.id, id))
    return NextResponse.json({ ok: true })
  }

  // Active/désactive un streamer (recrée ou supprime l'abonnement EventSub)
  if (action === 'toggle_streamer') {
    const { broadcasterId, active } = data as { broadcasterId: string; active: boolean }
    const streamer = await db.query.twitchStreamers.findFirst({ where: eq(twitchStreamers.broadcasterId, broadcasterId) })
    if (!streamer) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    let subscriptionId = streamer.subscriptionId
    if (active) {
      try { subscriptionId = await subscribeRedemptions(broadcasterId) ?? subscriptionId } catch (e) { console.error(e) }
    } else if (streamer.subscriptionId) {
      await deleteSubscription(streamer.subscriptionId)
      subscriptionId = null
    }

    await db.update(twitchStreamers)
      .set({ active, subscriptionId, updatedAt: new Date().toISOString() })
      .where(eq(twitchStreamers.broadcasterId, broadcasterId))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}

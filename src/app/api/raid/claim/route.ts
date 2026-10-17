import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { raids, raidContributions, raidClaims, boosterCredits } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { parseTiers, raidPhase } from '@/lib/game/raids'

// Réclame les boosters d'un palier atteint
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id

  const { raidId, tier } = await req.json() as { raidId: number; tier: number }
  if (!Number.isInteger(raidId) || !Number.isInteger(tier) || tier < 0)
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const [raid, contrib] = await Promise.all([
    db.query.raids.findFirst({ where: eq(raids.id, raidId) }),
    db.query.raidContributions.findFirst({
      where: and(eq(raidContributions.raidId, raidId), eq(raidContributions.userId, uid)),
    }),
  ])
  if (!raid) return NextResponse.json({ error: 'raid_not_found' }, { status: 404 })
  // Date de fin dépassée, délai de réclamation écoulé ou clôture admin : trop tard
  if (raidPhase(raid) === 'over') return NextResponse.json({ error: 'Le raid est terminé' }, { status: 410 })

  const tierDef = parseTiers(raid.tiers)[tier]
  if (!tierDef) return NextResponse.json({ error: 'tier_not_found' }, { status: 404 })
  if (raid.progress < tierDef.threshold)
    return NextResponse.json({ error: 'Palier pas encore atteint' }, { status: 400 })
  if ((contrib?.amount ?? 0) < raid.minContribution)
    return NextResponse.json({ error: `Participation insuffisante (${contrib?.amount ?? 0}/${raid.minContribution})` }, { status: 403 })

  // Batch atomique : si le palier a déjà été réclamé, la clé primaire de raid_claims
  // fait échouer l'insert et aucun booster n'est crédité.
  const credits = Array.from({ length: tierDef.boosters }, (_, i) => ({
    userId:      uid,
    boosterType: tierDef.boosterType,
    source:      'raid',
    sourceRef:   `raid:${raidId}:${tier}:${uid}:${i}`,
  }))
  try {
    await db.batch([
      db.insert(raidClaims).values({ raidId, userId: uid, tier }),
      db.insert(boosterCredits).values(credits),
    ])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY'))
      return NextResponse.json({ error: 'Palier déjà réclamé' }, { status: 409 })
    console.error('raid claim error:', e)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, boosters: tierDef.boosters, boosterType: tierDef.boosterType })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { raids, raidContributions, raidClaims } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { raidPhase, toPublicRaid } from '@/lib/game/raids'

// Participation du joueur connecté + paliers déjà réclamés + état à jour du raid.
// Renvoyer le raid ici évite un second appel à /api/raid après chaque action.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id
  const raidId = Number(req.nextUrl.searchParams.get('raidId'))
  if (!raidId) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const [raid, [contrib], claims] = await Promise.all([
    db.query.raids.findFirst({ where: eq(raids.id, raidId) }),
    db.select({ amount: raidContributions.amount }).from(raidContributions)
      .where(and(eq(raidContributions.raidId, raidId), eq(raidContributions.userId, uid))),
    db.select({ tier: raidClaims.tier }).from(raidClaims)
      .where(and(eq(raidClaims.raidId, raidId), eq(raidClaims.userId, uid))),
  ])

  return NextResponse.json({
    raid:         raid && raidPhase(raid) !== 'over' ? toPublicRaid(raid) : null,
    contribution: contrib?.amount ?? 0,
    claimedTiers: claims.map(c => c.tier),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

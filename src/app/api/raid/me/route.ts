import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { raids, raidContributions } from '@/lib/db/schema'
import { and, count, eq, gt } from 'drizzle-orm'
import { raidPhase, toPublicRaid } from '@/lib/game/raids'

// Participation du joueur connecté (dégâts, missions, classement, récompenses)
// + état à jour du raid, en une seule requête (appelée après une action ou à l'ouverture du détail).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = session.user.id
  const raidId = Number(req.nextUrl.searchParams.get('raidId'))
  if (!raidId) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const [raid, mine] = await Promise.all([
    db.query.raids.findFirst({ where: eq(raids.id, raidId) }),
    db.query.raidContributions.findFirst({
      where: and(eq(raidContributions.raidId, raidId), eq(raidContributions.userId, uid)),
    }),
  ])
  const damage = mine?.amount ?? 0

  // Classement : final s'il est calculé, sinon provisoire (nombre de joueurs devant + 1)
  let rank = mine?.rank ?? null
  if (rank == null && damage > 0) {
    const [ahead] = await db.select({ n: count() }).from(raidContributions)
      .where(and(eq(raidContributions.raidId, raidId), gt(raidContributions.amount, damage)))
    rank = (ahead?.n ?? 0) + 1
  }

  return NextResponse.json({
    raid:         raid && raidPhase(raid) !== 'over' ? await toPublicRaid(raid) : null,
    damage,
    missions:     mine?.missions ?? 0,
    missionDays:    mine?.missionDays ?? 0,       // jours avec ≥ 1 mission réclamée (assiduité)
    lastMissionDay: mine?.lastMissionDay ?? null, // YYYY-MM-DD UTC : mission du jour faite si = aujourd'hui
    rank,
    manaReward:   mine?.manaReward ?? null,
    promoGranted: !!mine?.promoGranted,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

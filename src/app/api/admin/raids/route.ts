import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, dbClient } from '@/lib/db'
import { raids, raidContributions, raidClaims } from '@/lib/db/schema'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { claimDeadline, invalidateRaidCache, isRaidObjective, parseTiers, raidPhase } from '@/lib/game/raids'

async function requireAdmin() {
  const session = await auth()
  return session?.user?.isAdmin ? session : null
}

// Liste des raids avec nombre de participants (total et éligibles) et de paliers réclamés
export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [rows, participants, claims] = await Promise.all([
    db.select().from(raids).orderBy(desc(raids.id)).limit(20),
    db.select({
      raidId:   raidContributions.raidId,
      total:    count(),
      eligible: sql<number>`SUM(CASE WHEN ${raidContributions.amount} >= ${raids.minContribution} THEN 1 ELSE 0 END)`,
    }).from(raidContributions)
      .innerJoin(raids, eq(raids.id, raidContributions.raidId))
      .groupBy(raidContributions.raidId),
    db.select({ raidId: raidClaims.raidId, total: count() }).from(raidClaims).groupBy(raidClaims.raidId),
  ])

  const pMap = Object.fromEntries(participants.map(p => [p.raidId, p]))
  const cMap = Object.fromEntries(claims.map(c => [c.raidId, c.total]))
  return NextResponse.json(rows.map(r => ({
    ...r,
    phase:        raidPhase(r),
    claimUntil:   claimDeadline(r),
    tiers:        parseTiers(r.tiers),
    participants: pMap[r.id]?.total ?? 0,
    eligible:     Number(pMap[r.id]?.eligible ?? 0),
    claims:       cMap[r.id] ?? 0,
  })))
}

// Création d'un raid (un seul actif à la fois)
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const title           = String(body.title ?? '').trim()
  const description     = String(body.description ?? '').trim() || null
  const objectiveType   = body.objectiveType
  const goal            = Math.floor(Number(body.goal))
  const minContribution = Math.max(1, Math.floor(Number(body.minContribution) || 1))
  const tiers           = parseTiers(JSON.stringify(body.tiers ?? []))
  const endsAt          = body.endsAt ? new Date(body.endsAt) : null

  if (!title)                          return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  if (!isRaidObjective(objectiveType)) return NextResponse.json({ error: 'Objectif invalide' }, { status: 400 })
  if (!(goal > 0))                     return NextResponse.json({ error: 'Objectif chiffré invalide' }, { status: 400 })
  if (!tiers.length)                   return NextResponse.json({ error: 'Au moins un palier requis' }, { status: 400 })
  if (tiers.some(t => t.threshold > goal))
    return NextResponse.json({ error: 'Un palier dépasse l\'objectif' }, { status: 400 })
  if (endsAt && (isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()))
    return NextResponse.json({ error: 'Date de fin invalide' }, { status: 400 })

  // Un raid encore visible (en cours ou en réclamation) bloque la création ;
  // les raids "active" déjà terminés (date passée, délai écoulé) sont clôturés
  const active = await db.select().from(raids).where(eq(raids.status, 'active'))
  if (active.some(r => raidPhase(r) !== 'over'))
    return NextResponse.json({ error: 'Un raid est déjà en cours (ou en période de réclamation). Termine-le avant d\'en créer un autre.' }, { status: 409 })
  if (active.length) await db.update(raids).set({ status: 'ended' }).where(eq(raids.status, 'active'))

  const [created] = await db.insert(raids).values({
    title, description, objectiveType, goal, minContribution,
    tiers:  JSON.stringify(tiers),
    endsAt: endsAt?.toISOString() ?? null,
  }).returning()

  invalidateRaidCache()
  return NextResponse.json(created)
}

// Accorde à tous les joueurs éligibles (participation >= minimum) les boosters des
// paliers atteints qu'ils n'ont pas encore réclamés. Batch atomique, par palier :
//  1. crédits boosters (même source_ref que la réclamation joueur → pas de doublon possible)
//  2. lignes raid_claims (le palier apparaît "Réclamé" côté joueur)
async function grantReachedTiers(raidId: number) {
  const raid = await db.query.raids.findFirst({ where: eq(raids.id, raidId) })
  if (!raid) return null

  const reached = parseTiers(raid.tiers)
    .map((tier, index) => ({ ...tier, index }))
    .filter(t => raid.progress >= t.threshold)
  if (!reached.length) return { tiers: 0, grants: 0, players: 0 }

  const statements = reached.flatMap(t => [
    {
      sql: `WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq WHERE n + 1 < ?)
            INSERT OR IGNORE INTO booster_credits (user_id, booster_type, source, source_ref)
            SELECT rc.user_id, ?, 'raid', 'raid:' || ? || ':' || ? || ':' || rc.user_id || ':' || seq.n
            FROM raid_contributions rc, seq
            WHERE rc.raid_id = ? AND rc.amount >= ?
              AND NOT EXISTS (SELECT 1 FROM raid_claims c WHERE c.raid_id = rc.raid_id AND c.user_id = rc.user_id AND c.tier = ?)`,
      args: [t.boosters, t.boosterType, raidId, t.index, raidId, raid.minContribution, t.index],
    },
    {
      sql: `INSERT OR IGNORE INTO raid_claims (raid_id, user_id, tier)
            SELECT raid_id, user_id, ? FROM raid_contributions WHERE raid_id = ? AND amount >= ?`,
      args: [t.index, raidId, raid.minContribution],
    },
  ])
  const results = await dbClient.batch(statements, 'write')

  // rowsAffected des inserts raid_claims (index impairs) = paliers effectivement accordés
  const grants = results.filter((_, i) => i % 2 === 1).reduce((s, r) => s + r.rowsAffected, 0)
  const [{ players }] = await db.select({ players: count() }).from(raidContributions)
    .where(and(eq(raidContributions.raidId, raidId), sql`${raidContributions.amount} >= ${raid.minContribution}`))
  return { tiers: reached.length, grants, players }
}

// Actions admin : { id, action: 'end' | 'grant' }
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action } = await req.json() as { id: number; action: string }
  if (!Number.isInteger(id) || (action !== 'end' && action !== 'grant'))
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  if (action === 'grant') {
    const result = await grantReachedTiers(id)
    if (!result) return NextResponse.json({ error: 'raid_not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...result })
  }

  // Clôture immédiate : le raid disparaît et plus rien n'est réclamable.
  // ends_at = maintenant (sauf s'il est déjà passé), pour l'historique admin.
  const nowIso = new Date().toISOString()
  await db.update(raids)
    .set({ status: 'ended', endsAt: sql`CASE WHEN ${raids.endsAt} IS NOT NULL AND ${raids.endsAt} < ${nowIso} THEN ${raids.endsAt} ELSE ${nowIso} END` })
    .where(and(eq(raids.id, id), eq(raids.status, 'active')))

  invalidateRaidCache()
  return NextResponse.json({ ok: true })
}

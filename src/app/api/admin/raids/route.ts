import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { raids, raidContributions, customCards } from '@/lib/db/schema'
import { and, count, desc, eq, gt, sql } from 'drizzle-orm'
import {
  BOSS_OBJECTIVE, finalizeRaid, invalidateRaidCache, missionDaysStatus, overkillMultiplier, parseRaidConfig,
  raidPhase, requiredMissionDays,
} from '@/lib/game/raids'

async function requireAdmin() {
  const session = await auth()
  return session?.user?.isAdmin ? session : null
}

// Liste des raids de boss avec participants, éligibles à la carte promo et récompenses distribuées.
// Distribue au passage les récompenses d'un raid arrivé à échéance.
export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const due = await db.select({ id: raids.id, status: raids.status, endsAt: raids.endsAt, finalizedAt: raids.finalizedAt })
    .from(raids).where(and(eq(raids.status, 'active'), eq(raids.objectiveType, BOSS_OBJECTIVE)))
  for (const r of due) if (raidPhase(r) === 'due') await finalizeRaid(r.id).catch(() => {})

  const [rows, stats, days] = await Promise.all([
    db.select().from(raids).where(eq(raids.objectiveType, BOSS_OBJECTIVE)).orderBy(desc(raids.id)).limit(20),
    db.select({
      raidId:       raidContributions.raidId,
      participants: count(),
      promoGiven:   sql<number>`SUM(CASE WHEN ${raidContributions.promoGranted} THEN 1 ELSE 0 END)`,
      manaGiven:    sql<number>`COALESCE(SUM(${raidContributions.manaReward}), 0)`,
    }).from(raidContributions).groupBy(raidContributions.raidId),
    // Assiduité par joueur (jours de mission) pour compter éligibles / encore dans la course
    db.select({
      raidId:         raidContributions.raidId,
      missionDays:    raidContributions.missionDays,
      lastMissionDay: raidContributions.lastMissionDay,
    }).from(raidContributions).where(gt(raidContributions.missionDays, 0)),
  ])

  const sMap = Object.fromEntries(stats.map(s => [s.raidId, s]))
  return NextResponse.json(rows.map(r => {
    const config = parseRaidConfig(r.config)
    const statuses = days.filter(d => d.raidId === r.id).map(d => missionDaysStatus(r, d.missionDays, d.lastMissionDay))
    return {
      ...r,
      config,
      phase:        raidPhase(r),
      killed:       r.progress >= r.goal,
      multiplier:   overkillMultiplier(config, r.progress, r.goal),
      requiredDays: requiredMissionDays(r),
      participants: sMap[r.id]?.participants ?? 0,
      eligible:     statuses.filter(s => s.eligible).length,
      stillPossible: statuses.filter(s => !s.eligible && s.possible).length,
      promoGiven:   Number(sMap[r.id]?.promoGiven ?? 0),
      manaGiven:    Number(sMap[r.id]?.manaGiven ?? 0),
    }
  }))
}

// Champs du formulaire (création et modification), validés
async function parseRaidBody(body: Record<string, unknown>) {
  const title        = String(body.bossName ?? '').trim()
  const description  = String(body.description ?? '').trim() || null
  const bossImageUrl = String(body.bossImageUrl ?? '').trim() || null
  const hp           = Math.floor(Number(body.hp))
  const promoCardId  = String(body.promoCardId ?? '').trim() || null
  const endsAt       = body.endsAt ? new Date(String(body.endsAt)) : null
  const config       = parseRaidConfig(JSON.stringify(body.config ?? {}))

  if (!title)    return { error: 'Nom du boss requis' }
  if (!(hp > 0)) return { error: 'PV du boss invalides' }
  if (!endsAt || isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) return { error: 'Date de fin invalide' }
  if (promoCardId && !await db.query.customCards.findFirst({ where: eq(customCards.id, promoCardId) }))
    return { error: 'Carte promo introuvable' }
  return { data: { title, description, bossImageUrl, hp, promoCardId, endsAt: endsAt.toISOString(), config } }
}

// Création d'un raid de boss (un seul en cours à la fois)
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseRaidBody(await req.json())
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { title, description, bossImageUrl, hp, promoCardId, endsAt, config } = parsed.data

  const active = await db.select({ id: raids.id, status: raids.status, endsAt: raids.endsAt, finalizedAt: raids.finalizedAt })
    .from(raids).where(eq(raids.status, 'active'))
  if (active.some(r => raidPhase(r) === 'running'))
    return NextResponse.json({ error: 'Un raid est déjà en cours. Termine-le avant d\'en lancer un autre.' }, { status: 409 })
  // Raids arrivés à échéance : on distribue avant d'en lancer un nouveau
  for (const r of active) await finalizeRaid(r.id).catch(() => {})

  const [created] = await db.insert(raids).values({
    title, description, bossImageUrl, promoCardId,
    objectiveType: BOSS_OBJECTIVE,
    goal:   hp,
    config: JSON.stringify(config),
    endsAt,
  }).returning()

  invalidateRaidCache()
  return NextResponse.json(created)
}

// Modification d'un raid en cours : { id, ...champs du formulaire }.
// Les dégâts déjà infligés sont conservés ; le statut "vaincu" suit les nouveaux PV.
export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const id = Number(body.id)
  const raid = Number.isInteger(id) ? await db.query.raids.findFirst({ where: eq(raids.id, id) }) : null
  if (!raid) return NextResponse.json({ error: 'Raid introuvable' }, { status: 404 })
  if (raidPhase(raid) !== 'running')
    return NextResponse.json({ error: 'Seul un raid en cours peut être modifié.' }, { status: 409 })

  const parsed = await parseRaidBody(body)
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { title, description, bossImageUrl, hp, promoCardId, endsAt, config } = parsed.data

  // Boss tué / ressuscité selon les nouveaux PV (completed_at = moment de la mort)
  const killedNow = raid.progress >= hp
  const completedAt = killedNow ? (raid.completedAt ?? new Date().toISOString()) : null

  const [updated] = await db.update(raids)
    .set({ title, description, bossImageUrl, promoCardId, goal: hp, endsAt, config: JSON.stringify(config), completedAt })
    .where(and(eq(raids.id, id), eq(raids.status, 'active')))
    .returning()
  if (!updated) return NextResponse.json({ error: 'Le raid vient de se terminer.' }, { status: 409 })

  invalidateRaidCache()
  return NextResponse.json(updated)
}

// Clôture immédiate : { id, action: 'end' } → fin maintenant + distribution des récompenses
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action } = await req.json() as { id: number; action: string }
  if (!Number.isInteger(id) || action !== 'end')
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const nowIso = new Date().toISOString()
  await db.update(raids).set({ endsAt: nowIso })
    .where(and(eq(raids.id, id), eq(raids.status, 'active'), sql`${raids.endsAt} > ${nowIso}`))
  try {
    await finalizeRaid(id)
  } catch {
    return NextResponse.json({ error: 'Erreur pendant la distribution des récompenses, réessaie.' }, { status: 500 })
  }
  invalidateRaidCache()
  const raid = await db.query.raids.findFirst({ where: eq(raids.id, id) })
  return NextResponse.json({ ok: true, killed: raid ? raid.progress >= raid.goal : false })
}

import { db } from '@/lib/db'
import { raids, raidContributions } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

// ── Raids : objectif communautaire ────────────────────────────────────────────
// Un seul raid actif à la fois. Chaque action du type choisi fait avancer la jauge
// commune (raids.progress) et la participation du joueur (raid_contributions).
// Les paliers atteints donnent des boosters à réclamer aux joueurs ayant
// contribué au moins min_contribution fois.

export const RAID_OBJECTIVES = {
  boosters_opened:  { label: 'Boosters ouverts',  unit: 'boosters'  },
  combats_won:      { label: 'Combats gagnés',    unit: 'victoires' },
  cards_recycled:   { label: 'Cartes recyclées',  unit: 'cartes'    },
  trades_completed: { label: 'Échanges réalisés', unit: 'échanges'  },
} as const

export type RaidObjective = keyof typeof RAID_OBJECTIVES

export function isRaidObjective(v: unknown): v is RaidObjective {
  return typeof v === 'string' && v in RAID_OBJECTIVES
}

export interface RaidTier {
  threshold:   number // progression globale à atteindre
  boosters:    number // nombre de boosters offerts
  boosterType: string // famille ('void' = toutes familles)
}

export type RaidRow = typeof raids.$inferSelect

export function parseTiers(json: string | null | undefined): RaidTier[] {
  try {
    const arr = JSON.parse(json || '[]')
    if (!Array.isArray(arr)) return []
    return arr
      .map(t => ({ threshold: Number(t.threshold), boosters: Number(t.boosters), boosterType: String(t.boosterType || 'void') }))
      .filter(t => t.threshold > 0 && t.boosters > 0)
      .sort((a, b) => a.threshold - b.threshold)
  } catch { return [] }
}

// Délai pour réclamer les récompenses une fois l'objectif atteint
export const RAID_CLAIM_WINDOW_HOURS = 24
const CLAIM_WINDOW_MS = RAID_CLAIM_WINDOW_HOURS * 3600_000

// Cycle de vie d'un raid :
//  - running : en cours (jauge active, paliers atteints déjà réclamables)
//  - claim   : objectif atteint → 24 h pour réclamer, puis le raid disparaît
//  - over    : date de fin passée sans atteindre l'objectif, délai de réclamation
//              écoulé ou clôture admin → invisible, plus rien à réclamer
export type RaidPhase = 'running' | 'claim' | 'over'

export function raidPhase(raid: Pick<RaidRow, 'status' | 'endsAt' | 'completedAt'>, now = Date.now()): RaidPhase {
  if (raid.status !== 'active') return 'over'
  if (raid.completedAt) return now < new Date(raid.completedAt).getTime() + CLAIM_WINDOW_MS ? 'claim' : 'over'
  if (raid.endsAt && now >= new Date(raid.endsAt).getTime()) return 'over'
  return 'running'
}

// Fin de la fenêtre de réclamation (null tant que l'objectif n'est pas atteint)
export function claimDeadline(raid: Pick<RaidRow, 'completedAt'>): string | null {
  return raid.completedAt ? new Date(new Date(raid.completedAt).getTime() + CLAIM_WINDOW_MS).toISOString() : null
}

// Raid à afficher aux joueurs : le dernier raid actif, s'il n'est pas terminé
export async function getDisplayRaid(): Promise<RaidRow | null> {
  const [row] = await db.select().from(raids)
    .where(eq(raids.status, 'active'))
    .orderBy(desc(raids.id))
    .limit(1)
  return row && raidPhase(row) !== 'over' ? row : null
}

// Cache court du raid actif : contributeToRaid est appelé à chaque action de jeu
const ACTIVE_TTL = 30_000
let activeCache: { raid: RaidRow | null; ts: number } | null = null

export function invalidateRaidCache() { activeCache = null }

async function getActiveRaid(): Promise<RaidRow | null> {
  if (activeCache && Date.now() - activeCache.ts < ACTIVE_TTL) return activeCache.raid
  const [row] = await db.select().from(raids).where(eq(raids.status, 'active')).orderBy(desc(raids.id)).limit(1)
  activeCache = { raid: row ?? null, ts: Date.now() }
  return activeCache.raid
}

// Enregistre une contribution au raid actif s'il correspond au type d'action.
// Best-effort : une erreur ici ne doit jamais faire échouer l'action du joueur.
// progress : avancée de la jauge (par défaut la somme des contributions ; un échange
// compte 1 pour la jauge mais 1 pour chacun des deux joueurs).
export async function contributeToRaid(
  type: RaidObjective,
  contributions: { userId: string; amount: number }[],
  progress = contributions.reduce((s, c) => s + c.amount, 0),
): Promise<void> {
  const valid = contributions.filter(c => c.userId && c.amount > 0)
  if (!valid.length || progress <= 0) return
  try {
    const raid = await getActiveRaid()
    // La participation compte aussi pendant la fenêtre de réclamation : un joueur
    // peut encore atteindre le minimum requis pour les récompenses
    if (!raid || raid.objectiveType !== type || raidPhase(raid) === 'over') return

    const nowIso = new Date().toISOString()
    await db.batch([
      // Jauge plafonnée à l'objectif ; completed_at posé une seule fois, quand elle l'atteint
      db.update(raids)
        .set({
          progress:    sql`MIN(${raids.progress} + ${progress}, ${raids.goal})`,
          completedAt: sql`CASE WHEN ${raids.completedAt} IS NULL AND ${raids.progress} + ${progress} >= ${raids.goal} THEN ${nowIso} ELSE ${raids.completedAt} END`,
        })
        .where(and(eq(raids.id, raid.id), eq(raids.status, 'active'))),
      ...valid.map(c => db.insert(raidContributions)
        .values({ raidId: raid.id, userId: c.userId, amount: c.amount, updatedAt: nowIso })
        .onConflictDoUpdate({
          target: [raidContributions.raidId, raidContributions.userId],
          set: { amount: sql`${raidContributions.amount} + ${c.amount}`, updatedAt: nowIso },
        })),
    ])
    // Objectif atteint : le cache doit voir completed_at pour calculer la fenêtre de réclamation
    if (raid.progress + progress >= raid.goal) invalidateRaidCache()
  } catch (e) {
    console.error('raid contribution error:', e)
  }
}

// Données publiques d'un raid envoyées aux joueurs (/api/raid et /api/raid/me)
export function toPublicRaid(raid: RaidRow) {
  return {
    id:              raid.id,
    title:           raid.title,
    description:     raid.description,
    objectiveType:   raid.objectiveType,
    goal:            raid.goal,
    progress:        Math.min(raid.progress, raid.goal),
    minContribution: raid.minContribution,
    tiers:           parseTiers(raid.tiers),
    phase:           raidPhase(raid) as Exclude<RaidPhase, 'over'>,
    endsAt:          raid.endsAt,
    claimUntil:      claimDeadline(raid),
  }
}

import { db, dbClient } from '@/lib/db'
import { raids, raidContributions, customCards, playerProfiles } from '@/lib/db/schema'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

// ── Raids de boss ─────────────────────────────────────────────────────────────
// Un seul raid à la fois, une semaine par défaut. Les joueurs infligent des dégâts
// au boss en ouvrant des boosters et en réclamant leurs missions quotidiennes.
// Le boss reste attaquable jusqu'à la fin : les dégâts au-delà de ses PV augmentent
// le multiplicateur de mana. À la date de fin, distribution automatique :
//  - boss tué  → carte promo aux joueurs ayant réclamé ≥ 1 mission pendant le raid,
//                mana selon le classement des dégâts × multiplicateur de dépassement
//  - boss vivant → rien

export const BOSS_OBJECTIVE = 'boss'

export interface RaidConfig {
  damage:      { booster: number; mission: number; allMissions: number }
  rankRewards: { upToRank: number | null; mana: number }[] // null = tous les autres participants
  overkill:    { ratio: number; multiplier: number }[]      // ratio = dégâts / PV (1.5 = 150 %)
}

export const DEFAULT_RAID_CONFIG: RaidConfig = {
  damage: { booster: 1, mission: 10, allMissions: 20 },
  rankRewards: [
    { upToRank: 1,    mana: 500 },
    { upToRank: 3,    mana: 300 },
    { upToRank: 10,   mana: 150 },
    { upToRank: null, mana: 50  },
  ],
  overkill: [
    { ratio: 1.5, multiplier: 1.5 },
    { ratio: 2,   multiplier: 2   },
    { ratio: 3,   multiplier: 3   },
  ],
}

const num = (v: unknown, fallback: number, min = 0) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? n : fallback
}

// Config d'un raid, complétée et assainie (valeurs absentes → défauts)
export function parseRaidConfig(json: string | null | undefined): RaidConfig {
  let raw: Partial<RaidConfig> = {}
  try { raw = JSON.parse(json || '{}') } catch { /* défauts */ }
  const d = DEFAULT_RAID_CONFIG
  const rankRewards = Array.isArray(raw.rankRewards) && raw.rankRewards.length
    ? raw.rankRewards.map(r => ({
        upToRank: r.upToRank == null ? null : Math.max(1, Math.floor(num(r.upToRank, 1, 1))),
        mana:     Math.floor(num(r.mana, 0)),
      }))
    : d.rankRewards
  // Paliers de rang triés, le "tous les autres" (null) en dernier
  rankRewards.sort((a, b) => (a.upToRank ?? Infinity) - (b.upToRank ?? Infinity))
  const overkill = Array.isArray(raw.overkill)
    ? raw.overkill
        .map(o => ({ ratio: num(o.ratio, 0), multiplier: num(o.multiplier, 1) }))
        .filter(o => o.ratio > 1 && o.multiplier >= 1)
        .sort((a, b) => a.ratio - b.ratio)
    : d.overkill
  return {
    damage: {
      booster:     Math.floor(num(raw.damage?.booster,     d.damage.booster)),
      mission:     Math.floor(num(raw.damage?.mission,     d.damage.mission)),
      allMissions: Math.floor(num(raw.damage?.allMissions, d.damage.allMissions)),
    },
    rankRewards,
    overkill,
  }
}

export function manaForRank(config: RaidConfig, rank: number): number {
  return config.rankRewards.find(r => r.upToRank == null || rank <= r.upToRank)?.mana ?? 0
}

// Multiplicateur de dépassement : le plus haut palier atteint (×1 sans dépassement)
export function overkillMultiplier(config: RaidConfig, damage: number, hp: number): number {
  if (hp <= 0 || damage < hp) return 1
  const ratio = damage / hp
  return config.overkill.filter(o => ratio >= o.ratio).reduce((m, o) => Math.max(m, o.multiplier), 1)
}

export type RaidRow = typeof raids.$inferSelect

// ── Assiduité (carte promo) ───────────────────────────────────────────────────
// Jour = date UTC, même découpage que les missions quotidiennes (todayStr des routes missions)
export const utcDay = (d: Date = new Date()) => d.toISOString().slice(0, 10)

// created_at est au format SQLite "YYYY-MM-DD HH:MM:SS" (UTC, sans suffixe)
export function raidStartDate(raid: Pick<RaidRow, 'createdAt'>): Date {
  return new Date(raid.createdAt.includes('T') ? raid.createdAt : raid.createdAt.replace(' ', 'T') + 'Z')
}

// Jours de mission requis pour la carte promo = durée du raid en jours entiers (7 pour une
// semaine). Un raid lancé en cours de journée touche un jour calendaire de plus : ça laisse
// une marge d'un jour à ceux qui découvrent le raid après son lancement.
export function requiredMissionDays(raid: Pick<RaidRow, 'createdAt' | 'endsAt'>): number {
  if (!raid.endsAt) return 1
  const ms = new Date(raid.endsAt).getTime() - raidStartDate(raid).getTime()
  return Math.max(1, Math.ceil(ms / 86400_000 - 0.001))
}

// Statut d'assiduité d'un joueur : déjà éligible, ou encore possible (en faisant une
// mission chaque jour restant, aujourd'hui compris s'il ne l'a pas encore fait)
export function missionDaysStatus(
  raid: Pick<RaidRow, 'createdAt' | 'endsAt'>,
  missionDays: number, lastMissionDay: string | null, now = new Date(),
) {
  const required = requiredMissionDays(raid)
  const today = utcDay(now)
  const lastDay = raid.endsAt ? utcDay(new Date(raid.endsAt)) : today
  const daysLeft = Math.max(0, Math.round((Date.parse(lastDay) - Date.parse(today)) / 86400_000) + 1)
    - (lastMissionDay === today ? 1 : 0)
  return {
    required,
    eligible: missionDays >= required,
    possible: missionDays + Math.max(0, daysLeft) >= required,
  }
}

// Durée d'affichage du résultat (boss vaincu / survivant) après la fin du raid
export const RAID_RESULTS_HOURS = 24
const RESULTS_MS = RAID_RESULTS_HOURS * 3600_000

//  running : en cours  ·  results : terminé, résultat affiché 48 h  ·  over : invisible
//  due     : date de fin passée, récompenses pas encore distribuées
export type RaidPhase = 'running' | 'due' | 'results' | 'over'

export function raidPhase(raid: Pick<RaidRow, 'status' | 'endsAt' | 'finalizedAt'>, now = Date.now()): RaidPhase {
  if (raid.status === 'ended') {
    return raid.finalizedAt && now < new Date(raid.finalizedAt).getTime() + RESULTS_MS ? 'results' : 'over'
  }
  if (raid.status === 'finalizing') return 'due'
  if (raid.endsAt && now >= new Date(raid.endsAt).getTime()) return 'due'
  return 'running'
}

// ── Distribution des récompenses ──────────────────────────────────────────────
// Appelée paresseusement (premier affichage après la date de fin, ou clôture admin).
// Le passage active → finalizing est atomique : une seule requête distribue.
// Tout le reste est fait en SQL ensembliste dans un batch atomique.
export async function finalizeRaid(raidId: number): Promise<void> {
  const nowIso = new Date().toISOString()
  const [raid] = await db.update(raids)
    .set({ status: 'finalizing' })
    .where(and(eq(raids.id, raidId), eq(raids.status, 'active'), sql`${raids.endsAt} <= ${nowIso}`))
    .returning()
  if (!raid) return // pas encore l'heure, ou déjà pris en charge

  try {
    const config = parseRaidConfig(raid.config)
    const killed = raid.progress >= raid.goal
    const statements: { sql: string; args: (string | number | null)[] }[] = []

    // Classement final : dégâts décroissants, à égalité le premier arrivé à ce total
    statements.push({
      sql: `UPDATE raid_contributions SET rank = (
              SELECT COUNT(*) + 1 FROM raid_contributions c2
              WHERE c2.raid_id = raid_contributions.raid_id
                AND (c2.amount > raid_contributions.amount
                  OR (c2.amount = raid_contributions.amount AND c2.updated_at < raid_contributions.updated_at)))
            WHERE raid_id = ? AND amount > 0`,
      args: [raidId],
    })

    if (killed) {
      const mult = overkillMultiplier(config, raid.progress, raid.goal)
      // Mana par rang : CASE construit depuis la config (valeurs numériques assainies)
      const cases = config.rankRewards
        .map(r => r.upToRank == null ? `ELSE ${r.mana}` : `WHEN rank <= ${r.upToRank} THEN ${r.mana}`)
      if (!cases.some(c => c.startsWith('ELSE'))) cases.push('ELSE 0')
      statements.push({
        sql: `UPDATE raid_contributions SET mana_reward = CAST(ROUND((CASE ${cases.join(' ')} END) * ?) AS INTEGER)
              WHERE raid_id = ? AND amount > 0`,
        args: [mult, raidId],
      })
      statements.push({
        sql: `UPDATE player_profiles SET mana = mana + (
                SELECT c.mana_reward FROM raid_contributions c WHERE c.raid_id = ? AND c.user_id = player_profiles.user_id)
              WHERE user_id IN (SELECT user_id FROM raid_contributions WHERE raid_id = ? AND mana_reward > 0)`,
        args: [raidId, raidId],
      })

      // Carte promo : récompense l'assiduité — au moins une mission réclamée chaque jour du raid
      const promo = raid.promoCardId
        ? await db.query.customCards.findFirst({ where: eq(customCards.id, raid.promoCardId) })
        : null
      if (promo) {
        statements.push({
          sql: `UPDATE raid_contributions SET promo_granted = 1 WHERE raid_id = ? AND mission_days >= ?`,
          args: [raidId, requiredMissionDays(raid)],
        })
        statements.push({
          sql: `INSERT INTO player_cards (user_id, card_id, rarity, family, count)
                SELECT user_id, ?, ?, ?, 1 FROM raid_contributions WHERE raid_id = ? AND promo_granted = 1
                ON CONFLICT(user_id, card_id) DO UPDATE SET count = count + 1, last_obtained_at = datetime('now')`,
          args: [promo.id, promo.rarity, promo.family, raidId],
        })
        // La carte devient visible (pour ceux qui la possèdent : elle reste exclusive)
        statements.push({ sql: `UPDATE custom_cards SET hidden = 0 WHERE id = ?`, args: [promo.id] })
      }
    }

    statements.push({
      sql: `UPDATE raids SET status = 'ended', finalized_at = ? WHERE id = ?`,
      args: [nowIso, raidId],
    })
    await dbClient.batch(statements, 'write')
    invalidateRaidCache()
  } catch (e) {
    // Échec : on rend la main pour qu'une prochaine requête retente la distribution
    await db.update(raids).set({ status: 'active' }).where(and(eq(raids.id, raidId), eq(raids.status, 'finalizing')))
    console.error('raid finalize error:', e)
    throw e
  }
}

// Raid à afficher : le dernier raid de boss, s'il est en cours ou affiche son résultat.
// Distribue les récompenses s'il vient de se terminer.
export async function getDisplayRaid(): Promise<RaidRow | null> {
  const [row] = await db.select().from(raids)
    .where(eq(raids.objectiveType, BOSS_OBJECTIVE))
    .orderBy(desc(raids.id))
    .limit(1)
  if (!row) return null
  if (raidPhase(row) === 'due' && row.status === 'active') {
    await finalizeRaid(row.id).catch(() => {})
    const [fresh] = await db.select().from(raids).where(eq(raids.id, row.id))
    return fresh && raidPhase(fresh) !== 'over' ? fresh : null
  }
  return raidPhase(row) === 'over' ? null : row
}

// ── Dégâts ────────────────────────────────────────────────────────────────────
// Cache court du raid actif : appelé à chaque booster ouvert / mission réclamée
const ACTIVE_TTL = 30_000
let activeCache: { raid: RaidRow | null; ts: number } | null = null

export function invalidateRaidCache() { activeCache = null }

async function getActiveRaid(): Promise<RaidRow | null> {
  if (activeCache && Date.now() - activeCache.ts < ACTIVE_TTL) return activeCache.raid
  const [row] = await db.select().from(raids)
    .where(and(eq(raids.status, 'active'), eq(raids.objectiveType, BOSS_OBJECTIVE)))
    .orderBy(desc(raids.id)).limit(1)
  activeCache = { raid: row ?? null, ts: Date.now() }
  return activeCache.raid
}

// Inflige des dégâts au boss du raid en cours.
// Best-effort : une erreur ici ne doit jamais faire échouer l'action du joueur.
export async function dealRaidDamage(
  userId: string,
  actions: { boosters?: number; missions?: number; allMissions?: number },
): Promise<void> {
  if (!userId) return
  try {
    const raid = await getActiveRaid()
    if (!raid || raidPhase(raid) !== 'running') return
    const { damage } = parseRaidConfig(raid.config)
    const missions = actions.missions ?? 0
    const dmg = (actions.boosters ?? 0) * damage.booster + missions * damage.mission + (actions.allMissions ?? 0) * damage.allMissions
    if (dmg <= 0 && missions <= 0) return

    const nowIso = new Date().toISOString()
    const today = utcDay()
    // Assiduité : un jour de mission compté au plus une fois par jour (première mission du jour)
    const dayFields = missions > 0 ? {
      missionDays:    sql`CASE WHEN ${raidContributions.lastMissionDay} = ${today} THEN ${raidContributions.missionDays} ELSE ${raidContributions.missionDays} + 1 END`,
      lastMissionDay: today,
    } : {}

    await db.batch([
      // completed_at : moment où le boss tombe à 0 PV (posé une seule fois)
      db.update(raids)
        .set({
          progress:    sql`${raids.progress} + ${dmg}`,
          completedAt: sql`CASE WHEN ${raids.completedAt} IS NULL AND ${raids.progress} + ${dmg} >= ${raids.goal} THEN ${nowIso} ELSE ${raids.completedAt} END`,
        })
        .where(and(eq(raids.id, raid.id), eq(raids.status, 'active'))),
      db.insert(raidContributions)
        .values({
          raidId: raid.id, userId, amount: dmg, missions, updatedAt: nowIso,
          missionDays: missions > 0 ? 1 : 0, lastMissionDay: missions > 0 ? today : null,
        })
        .onConflictDoUpdate({
          target: [raidContributions.raidId, raidContributions.userId],
          set: {
            amount:    sql`${raidContributions.amount} + ${dmg}`,
            missions:  sql`${raidContributions.missions} + ${missions}`,
            ...dayFields,
            updatedAt: nowIso,
          },
        }),
    ])
  } catch (e) {
    console.error('raid damage error:', e)
  }
}

// ── Données envoyées aux joueurs ──────────────────────────────────────────────
export async function getRaidLeaderboard(raidId: number, limit = 10) {
  return db.select({
    userId:   raidContributions.userId,
    damage:   raidContributions.amount,
    username: playerProfiles.username,
  })
    .from(raidContributions)
    .leftJoin(playerProfiles, eq(playerProfiles.userId, raidContributions.userId))
    .where(and(eq(raidContributions.raidId, raidId), gt(raidContributions.amount, 0)))
    .orderBy(desc(raidContributions.amount), raidContributions.updatedAt)
    .limit(limit)
}

export async function toPublicRaid(raid: RaidRow) {
  const config = parseRaidConfig(raid.config)
  const killed = raid.progress >= raid.goal
  const [promo, leaderboard] = await Promise.all([
    raid.promoCardId ? db.query.customCards.findFirst({ where: eq(customCards.id, raid.promoCardId) }) : null,
    getRaidLeaderboard(raid.id),
  ])
  return {
    id:           raid.id,
    bossName:     raid.title,
    description:  raid.description,
    bossImageUrl: raid.bossImageUrl,
    hp:           raid.goal,
    damage:       raid.progress,
    killed,
    phase:        raidPhase(raid) as 'running' | 'due' | 'results',
    endsAt:       raid.endsAt,
    startedAt:    raidStartDate(raid).toISOString(),
    requiredDays: requiredMissionDays(raid), // jours de mission requis pour la carte promo
    finalizedAt:  raid.finalizedAt,
    resultsUntil: raid.finalizedAt ? new Date(new Date(raid.finalizedAt).getTime() + RESULTS_MS).toISOString() : null,
    damageValues: config.damage,
    rankRewards:  config.rankRewards,
    overkill:     config.overkill,
    multiplier:   overkillMultiplier(config, raid.progress, raid.goal),
    // Carte promo dévoilée progressivement : le nom n'est révélé qu'à la mort du boss
    promo: promo ? {
      imageUrl: promo.imageUrl,
      rarity:   promo.rarity,
      name:     killed ? promo.name : null,
      reveal:   Math.min(1, raid.goal > 0 ? raid.progress / raid.goal : 0),
    } : null,
    leaderboard: leaderboard.map((l, i) => ({ rank: i + 1, username: l.username ?? 'Joueur', damage: l.damage })),
  }
}

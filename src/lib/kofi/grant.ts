import { db } from '@/lib/db'
import { playerProfiles, boosterCredits, kofiEvents } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

const SUB_DAYS = 34            // marge sur le cycle mensuel
const MONTHLY_BOOSTERS = 5     // boosters VOID offerts par paiement d'abonnement

// Accorde / prolonge l'abonnement + crédite les boosters mensuels (dédup par transaction).
export async function grantSubscription(userId: string, transactionId: string) {
  const until = new Date(Date.now() + SUB_DAYS * 24 * 3600 * 1000).toISOString()
  await db.update(playerProfiles)
    .set({ isSubscriber: true, subscriberUntil: until, updatedAt: new Date().toISOString() })
    .where(eq(playerProfiles.userId, userId))

  const rows = Array.from({ length: MONTHLY_BOOSTERS }, (_, i) => ({
    userId, boosterType: 'void', source: 'kofi',
    sourceRef: `kofi:${transactionId}:${i}`, createdBy: 'kofi',
  }))
  await db.insert(boosterCredits).values(rows).onConflictDoNothing()
}

// Cherche un joueur par email Discord OU email Ko-fi (insensible à la casse).
export async function findUserByEmail(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase()
  if (!e) return null
  const row = await db.select({ userId: playerProfiles.userId })
    .from(playerProfiles)
    .where(sql`lower(${playerProfiles.email}) = ${e} OR lower(${playerProfiles.kofiEmail}) = ${e}`)
    .limit(1).then(r => r[0])
  return row?.userId ?? null
}

// Applique les paiements Ko-fi en attente pour un email (appelé quand l'user lie son email Ko-fi).
export async function consumePendingForUser(userId: string, email: string) {
  const e = email.trim().toLowerCase()
  if (!e) return
  const pending = await db.select().from(kofiEvents)
    .where(and(
      sql`lower(${kofiEvents.email}) = ${e}`,
      eq(kofiEvents.isSubscription, true),
      eq(kofiEvents.processed, false),
    ))

  for (const ev of pending) {
    if (ev.transactionId) await grantSubscription(userId, ev.transactionId)
    await db.update(kofiEvents)
      .set({ matchedUserId: userId, processed: true })
      .where(eq(kofiEvents.id, ev.id))
  }
}

// Statut d'abonnement actif (flag + date non expirée).
export function isSubscriberActive(p: { isSubscriber?: boolean | null; subscriberUntil?: string | null }) {
  if (!p.isSubscriber) return false
  if (!p.subscriberUntil) return true
  return new Date(p.subscriberUntil).getTime() > Date.now()
}

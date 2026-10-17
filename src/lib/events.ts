import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Void Day : 1 booster acheté (mana ou Channel Points Twitch) = 1 booster offert.
// Désactivé par défaut, activable dans l'admin (onglet Paramètres).
export const VOID_DAY_KEY = 'event_void_day'

// Suffixe du sourceRef des boosters offerts : garde la déduplication par sourceRef
// et permet de retrouver les bonus en base (source_ref LIKE '%:void_day').
export const VOID_DAY_REF_SUFFIX = ':void_day'

// Lecture directe sans cache : l'activation/désactivation doit être immédiate
// sur toutes les instances, et ça ne coûte qu'une lecture par clé primaire par achat.
export async function isVoidDayActive(): Promise<boolean> {
  const row = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, VOID_DAY_KEY)).limit(1)
  return row[0]?.value === 'true'
}

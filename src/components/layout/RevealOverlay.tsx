import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { RevealCountdownLazy } from './RevealCountdownLazy'

export async function RevealOverlay() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'reveal_date')).limit(1)
    if (!row?.value) return null
    const revealDate = new Date(row.value)
    if (isNaN(revealDate.getTime())) return null
    return <RevealCountdownLazy revealDate={revealDate.toISOString()} />
  } catch {
    return null
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { kofiEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { grantSubscription, findUserByEmail } from '@/lib/kofi/grant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Webhook Ko-fi : POST application/x-www-form-urlencoded avec un champ `data` (JSON).
export async function POST(req: NextRequest) {
  let dataStr: string | null = null
  try {
    const form = await req.formData()
    dataStr = form.get('data') as string | null
  } catch {
    return NextResponse.json({ error: 'bad_form' }, { status: 400 })
  }
  if (!dataStr) return NextResponse.json({ error: 'no_data' }, { status: 400 })

  let d: {
    verification_token?: string
    kofi_transaction_id?: string
    message_id?: string
    type?: string
    email?: string
    tier_name?: string
    amount?: string
    is_subscription_payment?: boolean
  }
  try { d = JSON.parse(dataStr) } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // Vérifie le token de vérification configuré dans Ko-fi
  if (!process.env.KOFI_VERIFICATION_TOKEN || d.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 })
  }

  const transactionId = d.kofi_transaction_id ?? d.message_id ?? null
  const email = (d.email ?? '').toString()
  const isSub = !!d.is_subscription_payment

  // Déduplication
  const existing = transactionId
    ? await db.query.kofiEvents.findFirst({ where: eq(kofiEvents.transactionId, transactionId) })
    : null
  if (existing?.processed) return NextResponse.json({ ok: true, dedup: true })

  const userId = email ? await findUserByEmail(email) : null

  if (!existing && transactionId) {
    await db.insert(kofiEvents).values({
      transactionId, type: d.type ?? null, email,
      tierName: d.tier_name ?? null, amount: d.amount ?? null,
      isSubscription: isSub, matchedUserId: userId, processed: !!(userId && isSub),
    }).onConflictDoNothing()
  }

  // Abonnement matché → on accorde les avantages
  if (userId && isSub && transactionId) {
    await grantSubscription(userId, transactionId)
    await db.update(kofiEvents)
      .set({ matchedUserId: userId, processed: true })
      .where(eq(kofiEvents.transactionId, transactionId))
  }

  return NextResponse.json({ ok: true, matched: !!userId })
}

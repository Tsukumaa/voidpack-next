/**
 * supabase/functions/stripe-webhook/index.ts
 * VOID Pack — Stripe webhook handler
 * Gère : checkout.session.completed, customer.subscription.deleted
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',')
  const ts    = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const v1    = parts.find(p => p.startsWith('v1='))?.split('=')[1]
  if (!ts || !v1) return false

  const payload = `${ts}.${body}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const buf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === v1
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  const valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)
  if (!valid) return new Response('Invalid signature', { status: 403 })

  let event: any
  try { event = JSON.parse(body) } catch { return new Response('Invalid JSON', { status: 400 }) }

  const obj = event.data?.object

  // ── Checkout réussi ─────────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const userId    = obj.metadata?.user_id
    const mode      = obj.mode        // 'subscription' | 'payment'
    const customerId = obj.customer

    if (!userId) return new Response(JSON.stringify({ error: 'missing user_id in metadata' }), { status: 400 })

    if (mode === 'subscription') {
      // Abonnement — expires dans 31 jours (sera mis à jour par invoice.paid)
      const expiresAt = new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString()
      await supabase.rpc('activate_subscription', {
        p_user_id: userId,
        p_stripe_customer_id: customerId,
        p_expires_at: expiresAt,
      })

      // Créditer 3 boosters de bienvenue
      for (let i = 0; i < 3; i++) {
        await supabase.from('booster_credits').insert({
          user_id: userId, booster_type: 'void', source: 'subscription_welcome',
          source_ref: `${obj.id}-welcome-${i}`,
        })
      }
    }

    if (mode === 'payment') {
      const cardBackId = obj.metadata?.card_back_id
      if (cardBackId) {
        await supabase.rpc('unlock_card_back_purchase', { p_user_id: userId, p_card_back_id: cardBackId })
        await supabase.from('stripe_purchases').insert({
          id: obj.payment_intent, user_id: userId,
          product_type: 'card_back', product_id: cardBackId,
          amount_cents: obj.amount_total, currency: obj.currency, status: 'succeeded',
        })
      }
    }
  }

  // ── Renouvellement d'abonnement ──────────────────────────────────────────────
  if (event.type === 'invoice.paid') {
    const customerId = obj.customer
    const periodEnd  = obj.lines?.data?.[0]?.period?.end
    if (customerId && periodEnd) {
      const expiresAt = new Date(periodEnd * 1000).toISOString()
      await supabase.rpc('activate_subscription', {
        p_user_id: null, // on passe par customer_id
        p_stripe_customer_id: customerId,
        p_expires_at: expiresAt,
      })
      // Créditer 3 boosters mensuels
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
      if (profile) {
        for (let i = 0; i < 3; i++) {
          await supabase.from('booster_credits').insert({
            user_id: profile.user_id, booster_type: 'void', source: 'subscription_monthly',
            source_ref: `${obj.id}-monthly-${i}`,
          }).then(() => {})
        }
      }
    }
  }

  // ── Annulation d'abonnement ──────────────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    await supabase.rpc('deactivate_subscription', { p_stripe_customer_id: obj.customer })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

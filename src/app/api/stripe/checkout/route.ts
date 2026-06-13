/**
 * src/app/api/stripe/checkout/route.ts
 * Crée une session Stripe Checkout (abonnement ou achat unitaire)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID!
const CARD_BACK_PRICE_ID    = process.env.STRIPE_CARD_BACK_PRICE_ID!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non_authentifié' }, { status: 401 })

  const { mode, card_back_id, card_back_name } = await req.json()
  // mode: 'subscription' | 'payment'

  const origin = req.headers.get('origin') ?? 'https://voidpack.vercel.app'

  let session
  if (mode === 'subscription') {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/pack?checkout=success`,
      cancel_url:  `${origin}/pack?checkout=cancel`,
      metadata: { user_id: user.id },
      locale: 'fr',
      allow_promotion_codes: true,
    })
  } else {
    // Achat unitaire d'un dos de carte
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: 100, // 1,00€
          product_data: { name: `Dos de carte — ${card_back_name ?? card_back_id}` },
        },
        quantity: 1,
      }],
      success_url: `${origin}/pack?checkout=success`,
      cancel_url:  `${origin}/pack?checkout=cancel`,
      metadata: { user_id: user.id, card_back_id },
      locale: 'fr',
    })
  }

  return NextResponse.json({ url: session.url })
}

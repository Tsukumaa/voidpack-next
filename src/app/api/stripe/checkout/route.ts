import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' })

const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID!
const CARD_BACK_PRICE_ID    = process.env.STRIPE_CARD_BACK_PRICE_ID!

export async function POST(req: NextRequest) {
  const authSession = await auth()
  if (!authSession?.user?.id) return NextResponse.json({ error: 'non_authentifié' }, { status: 401 })
  const userId = authSession.user.id

  const { mode, card_back_id, card_back_name } = await req.json()

  const origin = req.headers.get('origin') ?? 'https://void-pack.fr'

  let checkoutSession: Stripe.Checkout.Session

  if (mode === 'subscription') {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/pack?checkout=success`,
      cancel_url:  `${origin}/pack?checkout=cancel`,
      metadata: { user_id: userId },
      locale: 'fr',
      allow_promotion_codes: true,
    })
  } else {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: 100,
          product_data: { name: `Dos de carte — ${card_back_name ?? card_back_id}` },
        },
        quantity: 1,
      }],
      success_url: `${origin}/pack?checkout=success`,
      cancel_url:  `${origin}/pack?checkout=cancel`,
      metadata: { user_id: userId, card_back_id },
      locale: 'fr',
    })
  }

  return NextResponse.json({ url: checkoutSession.url })
}

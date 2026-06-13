/**
 * supabase/functions/twitch-eventsub/index.ts
 * VOID Pack — Twitch Channel Points → crédit booster direct sur compte
 *
 * Reçoit les webhooks EventSub Twitch pour les rachats de Channel Points.
 * Pas de codes, pas de whispers : le booster est crédité directement
 * dans `booster_credits` via le `twitch_id` du joueur.
 *
 * ─── Variables d'environnement (Supabase Dashboard > Edge Functions > Secrets) ───
 * SUPABASE_URL              — auto-injecté
 * SUPABASE_SERVICE_ROLE_KEY — auto-injecté (clé service role)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Vérifie la signature HMAC-SHA256 du webhook avec le secret du streamer
async function verifySignature(req: Request, body: string, secret: string): Promise<boolean> {
  const msgId        = req.headers.get('Twitch-Eventsub-Message-Id') ?? ''
  const msgTimestamp = req.headers.get('Twitch-Eventsub-Message-Timestamp') ?? ''
  const signature    = req.headers.get('Twitch-Eventsub-Message-Signature') ?? ''
  if (!signature.startsWith('sha256=')) return false

  const message = msgId + msgTimestamp + body
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}` === signature
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const body = await req.text()
  const messageType = req.headers.get('Twitch-Eventsub-Message-Type')

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // ── 1. Détecter le broadcaster pour récupérer son secret ────────────────
  const broadcasterId =
    payload?.subscription?.condition?.broadcaster_user_id ??
    payload?.event?.broadcaster_user_id

  if (!broadcasterId) return json({ error: 'missing_broadcaster_id' }, 400)

  const { data: streamer } = await supabase
    .from('twitch_streamers')
    .select('broadcaster_id, broadcaster_login, eventsub_secret, active')
    .eq('broadcaster_id', broadcasterId)
    .maybeSingle()

  if (!streamer || !streamer.active) {
    return json({ error: 'unknown_or_inactive_streamer' }, 404)
  }

  // ── 2. Vérifier la signature HMAC ────────────────────────────────────────
  const validSig = await verifySignature(req, body, streamer.eventsub_secret)
  if (!validSig) return json({ error: 'invalid_signature' }, 403)

  // ── 3. Challenge de vérification (webhook_callback_verification) ────────
  if (messageType === 'webhook_callback_verification') {
    return new Response(payload.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // ── 4. Notification réelle ───────────────────────────────────────────────
  if (messageType === 'notification') {
    const subType = payload?.subscription?.type
    const event   = payload?.event

    if (subType === 'channel.channel_points_custom_reward_redemption.add') {
      const rewardId     = event?.reward?.id
      const redemptionId = event?.id
      const twitchUserId = event?.user_id
      const twitchLogin  = event?.user_login

      const { data, error } = await supabase.rpc('credit_booster_by_twitch_id_for_reward', {
        p_twitch_id:        twitchUserId,
        p_twitch_login:     twitchLogin,
        p_reward_id:        rewardId,
        p_redemption_id:    redemptionId,
        p_broadcaster_id:   streamer.broadcaster_id,
        p_broadcaster_login: streamer.broadcaster_login,
      })

      if (error) {
        console.error('credit_booster_by_twitch_id_for_reward error:', error)
        return json({ error: error.message }, 500)
      }

      console.log('Redemption processed:', data)
      return json({ ok: true, result: data })
    }

    // Autres types d'événements non géré — on accuse réception
    return json({ ok: true, ignored: subType })
  }

  // ── 5. Revocation ─────────────────────────────────────────────────────────
  if (messageType === 'revocation') {
    console.warn('EventSub subscription revoked:', payload?.subscription)
    return json({ ok: true })
  }

  return json({ ok: true })
})
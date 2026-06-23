// Helpers Twitch Helix + EventSub.
// Variables d'environnement requises :
//   TWITCH_CLIENT_ID       — client id de l'app Twitch
//   TWITCH_CLIENT_SECRET   — client secret de l'app Twitch
//   TWITCH_EVENTSUB_SECRET — secret partagé pour signer/vérifier les webhooks EventSub
//   AUTH_URL               — base URL du site (ex: https://void-pack.fr)

const TWITCH_CLIENT_ID     = process.env.TWITCH_CLIENT_ID!
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!
export const EVENTSUB_SECRET = process.env.TWITCH_EVENTSUB_SECRET!

const HELIX = 'https://api.twitch.tv/helix'
const OAUTH = 'https://id.twitch.tv/oauth2'

export const REDEMPTION_EVENT = 'channel.channel_points_custom_reward_redemption.add'

export function siteUrl() {
  return (process.env.AUTH_URL ?? 'https://void-pack.fr').replace(/\/$/, '')
}

export function streamerRedirectUri() {
  return `${siteUrl()}/api/twitch/streamer/callback`
}

export function eventsubCallbackUrl() {
  return `${siteUrl()}/api/twitch/eventsub`
}

// URL d'autorisation OAuth pour qu'un streamer connecte sa chaîne
export function streamerAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id:     TWITCH_CLIENT_ID,
    redirect_uri:  streamerRedirectUri(),
    response_type: 'code',
    scope:         'channel:read:redemptions',
    state,
  })
  return `${OAUTH}/authorize?${params.toString()}`
}

// Échange le code OAuth contre les tokens utilisateur
export async function exchangeCode(code: string) {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  streamerRedirectUri(),
    }),
  })
  if (!res.ok) throw new Error(`exchangeCode failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; scope: string[]; expires_in: number }>
}

// Rafraîchit un token utilisateur expiré
export async function refreshUserToken(refreshToken: string) {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`refreshUserToken failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; scope: string[] }>
}

// App access token (client credentials) — requis pour créer les abonnements EventSub webhook
export async function getAppToken() {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type:    'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`getAppToken failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// Récupère l'utilisateur Twitch associé à un token (pour obtenir broadcaster_id + login)
export async function getAuthedUser(accessToken: string) {
  const res = await fetch(`${HELIX}/users`, {
    headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`getAuthedUser failed: ${res.status}`)
  const data = await res.json() as { data: { id: string; login: string; display_name: string }[] }
  return data.data[0]
}

// Crée l'abonnement EventSub aux rachats de Channel Points pour un broadcaster.
// Retourne l'id de l'abonnement, ou null si déjà existant.
export async function subscribeRedemptions(broadcasterId: string) {
  const appToken = await getAppToken()
  const res = await fetch(`${HELIX}/eventsub/subscriptions`, {
    method: 'POST',
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: REDEMPTION_EVENT,
      version: '1',
      condition: { broadcaster_user_id: broadcasterId },
      transport: {
        method: 'webhook',
        callback: eventsubCallbackUrl(),
        secret: EVENTSUB_SECRET,
      },
    }),
  })

  if (res.status === 409) return null // déjà abonné
  if (!res.ok) throw new Error(`subscribeRedemptions failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { data: { id: string }[] }
  return data.data[0]?.id ?? null
}

// Supprime un abonnement EventSub
export async function deleteSubscription(subscriptionId: string) {
  const appToken = await getAppToken()
  await fetch(`${HELIX}/eventsub/subscriptions?id=${subscriptionId}`, {
    method: 'DELETE',
    headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${appToken}` },
  }).catch(() => {})
}

import { db } from '@/lib/db'
import { twitchStreamers, settings } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { sendChatMessage, refreshUserToken } from '@/lib/twitch/api'

// Clés des templates de messages dans la table settings (éditables dans l'admin)
export const MSG_KEYS = {
  void:      'twitch_msg_void',
  legendary: 'twitch_msg_legendary',
} as const

// Messages par défaut si rien n'est configuré dans l'admin.
// Variables disponibles : {viewer} = nom du viewer, {card} = nom de la carte
export const DEFAULT_MESSAGES: Record<string, string> = {
  void:      '🎉 Bravo @{viewer} qui vient de pull une carte VOID ⬛ {card} dans son booster VOID Pack !',
  legendary: '🎉 Bravo @{viewer} qui vient de pull une carte Légendaire 🌟 {card} dans son booster VOID Pack !',
}

function fillTemplate(tpl: string, vars: { viewer: string; card: string }) {
  return tpl
    .replaceAll('{viewer}', vars.viewer)
    .replaceAll('{card}', vars.card)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Annonce un pull rare dans le chat du streamer (best-effort, ne throw jamais).
export async function announceRarePull(opts: {
  broadcasterId: string
  viewerName: string
  rarity: string
  cardName?: string | null
}) {
  const key = MSG_KEYS[opts.rarity as keyof typeof MSG_KEYS]
  if (!key) return // on n'annonce que void / legendary

  const streamer = await db.query.twitchStreamers.findFirst({
    where: eq(twitchStreamers.broadcasterId, opts.broadcasterId),
  })
  if (!streamer || !streamer.active || !streamer.accessToken) return

  // Charge le template personnalisé (ou défaut)
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1).then(r => r[0])
  const tpl = (row?.value && row.value.trim()) ? row.value : DEFAULT_MESSAGES[opts.rarity]

  const message = fillTemplate(tpl, {
    viewer: opts.viewerName,
    card:   opts.cardName ? `« ${opts.cardName} »` : '',
  })

  // Tentative d'envoi, avec refresh de token si expiré (401)
  let res = await sendChatMessage(opts.broadcasterId, streamer.accessToken, message).catch(() => null)

  if (res && res.status === 401 && streamer.refreshToken) {
    try {
      const refreshed = await refreshUserToken(streamer.refreshToken)
      await db.update(twitchStreamers).set({
        accessToken:  refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        scope:        (refreshed.scope ?? []).join(' '),
        updatedAt:    new Date().toISOString(),
      }).where(eq(twitchStreamers.broadcasterId, opts.broadcasterId))
      res = await sendChatMessage(opts.broadcasterId, refreshed.access_token, message).catch(() => null)
    } catch (e) {
      console.error('refresh token (announce) error:', e)
    }
  }

  if (res && !res.ok) {
    console.warn('announceRarePull failed:', res.status, await res.text().catch(() => ''))
  }
}

// Récupère les templates actuels (pour l'admin)
export async function getMessageTemplates() {
  const rows = await db.select().from(settings).where(inArray(settings.key, [MSG_KEYS.void, MSG_KEYS.legendary]))
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    void:      map[MSG_KEYS.void]      ?? DEFAULT_MESSAGES.void,
    legendary: map[MSG_KEYS.legendary] ?? DEFAULT_MESSAGES.legendary,
  }
}

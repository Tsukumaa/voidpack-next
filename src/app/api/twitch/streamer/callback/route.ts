import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { twitchStreamers, playerProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { exchangeCode, getAuthedUser, subscribeRedemptions } from '@/lib/twitch/api'

export const dynamic = 'force-dynamic'

function redirectProfil(msg: string) {
  const base = (process.env.AUTH_URL ?? '').replace(/\/$/, '')
  return NextResponse.redirect(`${base}/profil?twitch=${msg}`)
}

// Callback OAuth : échange le code, enregistre le streamer, crée l'abonnement EventSub.
export async function GET(req: NextRequest) {
  const session = await auth()
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('twitch_streamer_state')?.value

  if (!session?.user?.id) return redirectProfil('not_authenticated')
  if (!code || !state || state !== cookieState) return redirectProfil('state_error')

  try {
    const tokens = await exchangeCode(code)
    const tUser  = await getAuthedUser(tokens.access_token)
    if (!tUser?.id) return redirectProfil('user_error')

    // Crée l'abonnement EventSub aux Channel Points
    let subscriptionId: string | null = null
    try {
      subscriptionId = await subscribeRedemptions(tUser.id)
    } catch (e) {
      console.error('subscribeRedemptions error:', e)
    }

    await db
      .insert(twitchStreamers)
      .values({
        broadcasterId:    tUser.id,
        broadcasterLogin: tUser.login,
        userId:           session.user.id,
        accessToken:      tokens.access_token,
        refreshToken:     tokens.refresh_token,
        scope:            (tokens.scope ?? []).join(' '),
        active:           true,
        subscriptionId,
      })
      .onConflictDoUpdate({
        target: twitchStreamers.broadcasterId,
        set: {
          broadcasterLogin: tUser.login,
          userId:           session.user.id,
          accessToken:      tokens.access_token,
          refreshToken:     tokens.refresh_token,
          scope:            (tokens.scope ?? []).join(' '),
          active:           true,
          ...(subscriptionId ? { subscriptionId } : {}),
          updatedAt:        new Date().toISOString(),
        },
      })

    // Marque aussi le compte joueur comme lié à Twitch + rôle streamer
    await db
      .update(playerProfiles)
      .set({ twitchId: tUser.id, twitchLogin: tUser.login, role: 'streamer', updatedAt: new Date().toISOString() })
      .where(eq(playerProfiles.userId, session.user.id))

    const res = redirectProfil('connected')
    res.cookies.delete('twitch_streamer_state')
    return res
  } catch (e) {
    console.error('twitch streamer callback error:', e)
    return redirectProfil('error')
  }
}

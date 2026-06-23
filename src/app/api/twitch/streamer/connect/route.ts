import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { streamerAuthUrl } from '@/lib/twitch/api'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// Démarre le flux OAuth Twitch pour connecter la chaîne d'un streamer.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${process.env.AUTH_URL ?? ''}/profil`)
  }

  // state = nonce, stocké en cookie httpOnly pour vérif au retour
  const nonce = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(streamerAuthUrl(nonce))
  res.cookies.set('twitch_streamer_state', nonce, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}

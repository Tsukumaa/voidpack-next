import { NextResponse } from 'next/server'

// Auth.js gère le callback OAuth via /api/auth/callback/discord
// Cette route redirige pour compatibilité avec les anciens liens bookmarkés.
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/pack`)
}

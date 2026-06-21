import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default auth((req) => {
  const maintenance = process.env.MAINTENANCE_MODE === 'true'
  if (!maintenance) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Toujours laisser passer : assets, auth, page maintenance elle-même
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/maintenance'
  ) {
    return NextResponse.next()
  }

  // Les admins passent partout
  if ((req.auth?.user as { isAdmin?: boolean })?.isAdmin) {
    return NextResponse.next()
  }

  // Tout le monde d'autre → page maintenance
  return NextResponse.redirect(new URL('/maintenance', req.url))
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
}

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const maintenance = process.env.MAINTENANCE_MODE === 'true'
  if (!maintenance) return NextResponse.next()

  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/maintenance'
  ) {
    return NextResponse.next()
  }

  if ((req.auth?.user as { isAdmin?: boolean })?.isAdmin) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/maintenance', req.url))
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|api/auth).*)'],
}

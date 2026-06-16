import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid   = session.user.id
  const after = req.nextUrl.searchParams.get('after')

  const where = after
    ? and(eq(directMessages.receiverId, uid), gt(directMessages.id, Number(after)))
    : eq(directMessages.receiverId, uid)

  const rows = await db.query.directMessages.findMany({
    where,
    orderBy: (t, { asc }) => [asc(t.id)],
    limit: 50,
  })

  return NextResponse.json(rows)
}

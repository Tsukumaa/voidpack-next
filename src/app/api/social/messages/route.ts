import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages } from '@/lib/db/schema'
import { eq, or, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })
  const uid = session.user.id

  const otherId = req.nextUrl.searchParams.get('with')
  const limit   = Number(req.nextUrl.searchParams.get('limit') ?? 50)

  if (!otherId) return NextResponse.json([], { status: 400 })

  const rows = await db
    .select()
    .from(directMessages)
    .where(or(
      and(eq(directMessages.senderId, uid), eq(directMessages.receiverId, otherId)),
      and(eq(directMessages.senderId, otherId), eq(directMessages.receiverId, uid)),
    ))
    .orderBy(desc(directMessages.createdAt))
    .limit(limit)

  return NextResponse.json(rows.reverse())
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId, content } = await req.json()
  const [msg] = await db
    .insert(directMessages)
    .values({ senderId: session.user.id, receiverId, content: content.trim().slice(0, 500) })
    .returning()

  return NextResponse.json(msg)
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ count: 0 })

  const rows = await db.select({ id: directMessages.id })
    .from(directMessages)
    .where(and(
      eq(directMessages.receiverId, session.user.id),
      isNull(directMessages.readAt),
    ))

  return NextResponse.json({ count: rows.length })
}

// Mark all messages from a sender as read
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false })

  await db.update(directMessages)
    .set({ readAt: new Date().toISOString() })
    .where(and(
      eq(directMessages.receiverId, session.user.id),
      isNull(directMessages.readAt),
    ))

  return NextResponse.json({ ok: true })
}

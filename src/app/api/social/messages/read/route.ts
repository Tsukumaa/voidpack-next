import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { directMessages } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { senderId } = await req.json()
  if (!senderId) return NextResponse.json({ error: 'senderId requis.' }, { status: 400 })

  const now = new Date().toISOString()

  await db.update(directMessages)
    .set({ readAt: now })
    .where(
      and(
        eq(directMessages.senderId, senderId),
        eq(directMessages.receiverId, session.user.id),
        isNull(directMessages.readAt),
      )
    )

  return NextResponse.json({ ok: true })
}

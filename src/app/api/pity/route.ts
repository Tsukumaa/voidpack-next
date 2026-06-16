import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerPityState } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  let pity = await db.query.playerPityState.findFirst({
    where: eq(playerPityState.userId, session.user.id),
  })

  if (!pity) {
    const [created] = await db
      .insert(playerPityState)
      .values({ userId: session.user.id })
      .returning()
    pity = created
  }

  return NextResponse.json({
    packsSinceLegendary: pity.packsSinceLegendary,
    packsSinceVoid:      pity.packsSinceVoid,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 })

  const cards: Array<{ rarity: string }> = await req.json()

  const current = await db.query.playerPityState.findFirst({
    where: eq(playerPityState.userId, session.user.id),
  })

  let packsSinceLegendary = (current?.packsSinceLegendary ?? 0) + 1
  let packsSinceVoid      = (current?.packsSinceVoid ?? 0) + 1

  const pulledLegendary = cards.some(c => c.rarity === 'legendary' || c.rarity === 'void')
  const pulledVoid      = cards.some(c => c.rarity === 'void')

  if (pulledLegendary) packsSinceLegendary = 0
  if (pulledVoid)      packsSinceVoid = 0

  await db
    .insert(playerPityState)
    .values({ userId: session.user.id, packsSinceLegendary, packsSinceVoid })
    .onConflictDoUpdate({
      target: playerPityState.userId,
      set: { packsSinceLegendary, packsSinceVoid, updatedAt: new Date().toISOString() },
    })

  return NextResponse.json({ packsSinceLegendary, packsSinceVoid, pulledLegendary, pulledVoid })
}

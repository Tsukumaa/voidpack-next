import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { grantXp } from '@/lib/game/xp'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { xp: xpGain } = await req.json()
  const result = await grantXp(session.user.id, xpGain)
  return NextResponse.json(result)
}

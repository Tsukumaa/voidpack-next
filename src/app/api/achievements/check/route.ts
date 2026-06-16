import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerAchievements } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })

  const { rarities, totalPacks, uniqueCards, boosterType, level } = await req.json()
  const uid = session.user.id

  const toUnlock: string[] = []

  if (totalPacks >= 1)   toUnlock.push('open_first')
  if (totalPacks >= 10)  toUnlock.push('open_10')
  if (totalPacks >= 50)  toUnlock.push('open_50')
  if (totalPacks >= 100) toUnlock.push('open_100')

  if (rarities.some((r: string) => ['rare','epic','legendary','void'].includes(r))) toUnlock.push('get_rare')
  if (rarities.some((r: string) => ['epic','legendary','void'].includes(r))) toUnlock.push('get_epic')
  if (rarities.some((r: string) => ['legendary','void'].includes(r))) toUnlock.push('get_legendary')
  if (rarities.includes('void')) toUnlock.push('get_void')

  if (uniqueCards >= 10)  toUnlock.push('cards_10')
  if (uniqueCards >= 25)  toUnlock.push('cards_25')
  if (uniqueCards >= 50)  toUnlock.push('cards_50')
  if (uniqueCards >= 100) toUnlock.push('cards_100')

  if (level >= 5)  toUnlock.push('level_5')
  if (level >= 10) toUnlock.push('level_10')
  if (level >= 25) toUnlock.push('level_25')
  if (level >= 50) toUnlock.push('level_50')

  if (toUnlock.length) {
    await db
      .insert(playerAchievements)
      .values(toUnlock.map(id => ({ userId: uid, achievementId: id })))
      .onConflictDoNothing()
  }

  return NextResponse.json({ ok: true })
}

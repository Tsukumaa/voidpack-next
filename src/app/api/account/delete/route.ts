import { NextResponse } from 'next/server'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userId = session.user.id

  try {
    await db.run(sql.raw(`DELETE FROM card_instances WHERE owner_id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM player_missions WHERE player_id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM daily_rewards WHERE player_id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM friendships WHERE user_id = '${userId}' OR friend_id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM trade_requests WHERE sender_id = '${userId}' OR receiver_id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM player_profiles WHERE id = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM sessions WHERE userId = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM accounts WHERE userId = '${userId}'`))
    await db.run(sql.raw(`DELETE FROM users WHERE id = '${userId}'`))

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

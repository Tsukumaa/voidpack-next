import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userId = session.user.id

  try {
    const u = userId.replace(/'/g, "''")
    await Promise.all([
      db.run(sql.raw(`DELETE FROM card_instances WHERE owner_id = '${u}'`)),
      db.run(sql.raw(`DELETE FROM player_missions WHERE player_id = '${u}'`)),
      db.run(sql.raw(`DELETE FROM daily_rewards WHERE player_id = '${u}'`)),
      db.run(sql.raw(`DELETE FROM friendships WHERE user_id = '${u}' OR friend_id = '${u}'`)),
      db.run(sql.raw(`DELETE FROM trade_requests WHERE sender_id = '${u}' OR receiver_id = '${u}'`)),
    ])
    await Promise.all([
      db.run(sql.raw(`DELETE FROM player_profiles WHERE id = '${u}'`)),
      db.run(sql.raw(`DELETE FROM sessions WHERE userId = '${u}'`)),
      db.run(sql.raw(`DELETE FROM accounts WHERE userId = '${u}'`)),
    ])
    await db.run(sql.raw(`DELETE FROM users WHERE id = '${u}'`))

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

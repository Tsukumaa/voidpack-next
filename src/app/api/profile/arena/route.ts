import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings, arenaBackgrounds } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Stocke l'arène sélectionnée par utilisateur dans la table settings : "arena:{userId}"

const DEFAULT_IMG = '/assets/bg-void.png'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ arenaId: 'default', imageUrl: DEFAULT_IMG })

  const key = `arena:${session.user.id}`
  try {
    const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
    const arenaId = row[0]?.value ?? 'default'
    if (arenaId === 'default') {
      const defaultArena = await db.select().from(arenaBackgrounds).limit(1)
      return NextResponse.json({ arenaId, imageUrl: defaultArena[0]?.imageUrl ?? DEFAULT_IMG })
    }

    const arena = await db.select().from(arenaBackgrounds).where(eq(arenaBackgrounds.id, arenaId)).limit(1)
    return NextResponse.json({ arenaId, imageUrl: arena[0]?.imageUrl ?? DEFAULT_IMG })
  } catch {
    return NextResponse.json({ arenaId: 'default', imageUrl: DEFAULT_IMG })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arenaId } = await req.json()
  if (!arenaId) return NextResponse.json({ error: 'arenaId manquant.' }, { status: 400 })

  const key = `arena:${session.user.id}`
  await db
    .insert(settings)
    .values({ key, value: arenaId })
    .onConflictDoUpdate({ target: settings.key, set: { value: arenaId } })

  return NextResponse.json({ ok: true })
}

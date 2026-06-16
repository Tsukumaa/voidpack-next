import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { families } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(families)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, label } = await req.json()
  await db.insert(families).values({ key, label }).onConflictDoUpdate({
    target: families.key,
    set: { label },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key } = await req.json()
  if (key === 'global') return NextResponse.json({ error: 'Cannot delete global family' }, { status: 400 })
  await db.delete(families).where(eq(families.key, key))
  return NextResponse.json({ ok: true })
}

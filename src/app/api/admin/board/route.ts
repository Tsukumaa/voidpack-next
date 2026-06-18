import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { kanbanCards } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// Auto-create table on first use
async function ensureTable() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS kanban_cards (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    column      TEXT NOT NULL DEFAULT 'todo',
    tag         TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

export async function GET() {
  await ensureTable()
  const cards = await db.select().from(kanbanCards).orderBy(asc(kanbanCards.position))
  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  await ensureTable()
  const body = await req.json()
  const id = crypto.randomUUID()
  await db.insert(kanbanCards).values({
    id,
    title:       body.title ?? 'Sans titre',
    description: body.description ?? null,
    column:      body.column ?? 'todo',
    tag:         body.tag ?? null,
    position:    body.position ?? 0,
    createdBy:   body.createdBy ?? null,
  })
  const [card] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id))
  return NextResponse.json(card)
}

export async function PATCH(req: NextRequest) {
  await ensureTable()
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (fields.title       !== undefined) update.title       = fields.title
  if (fields.description !== undefined) update.description = fields.description
  if (fields.column      !== undefined) update.column      = fields.column
  if (fields.tag         !== undefined) update.tag         = fields.tag
  if (fields.position    !== undefined) update.position    = fields.position

  await db.update(kanbanCards).set(update).where(eq(kanbanCards.id, id))
  const [card] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id))
  return NextResponse.json(card)
}

export async function DELETE(req: NextRequest) {
  await ensureTable()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.delete(kanbanCards).where(eq(kanbanCards.id, id))
  return NextResponse.json({ ok: true })
}

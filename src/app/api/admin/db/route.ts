import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Generic admin table operations via Drizzle raw SQL
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, table, data, eq: eqFilter } = await req.json()

  try {
    let result
    if (action === 'select') {
      result = await db.run(sql.raw(`SELECT ${data?.select ?? '*'} FROM ${table}${data?.order ? ` ORDER BY ${data.order}` : ''}`))
    } else if (action === 'insert') {
      const cols = Object.keys(data).join(', ')
      const vals = Object.values(data).map(v => `'${v}'`).join(', ')
      result = await db.run(sql.raw(`INSERT INTO ${table} (${cols}) VALUES (${vals})`))
    } else if (action === 'update') {
      const sets = Object.entries(data).map(([k, v]) => `${k}='${v}'`).join(', ')
      result = await db.run(sql.raw(`UPDATE ${table} SET ${sets} WHERE ${eqFilter.col}='${eqFilter.val}'`))
    } else if (action === 'delete') {
      result = await db.run(sql.raw(`DELETE FROM ${table} WHERE ${eqFilter.col}='${eqFilter.val}'`))
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ data: result.rows })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

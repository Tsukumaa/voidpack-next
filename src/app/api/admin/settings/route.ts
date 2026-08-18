import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Route interne appelée uniquement par le middleware pour lire un setting
export async function GET(req: NextRequest) {
  if (req.headers.get('x-internal') !== '1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ value: null })

  try {
    const result = await db.run(sql.raw(`SELECT value FROM settings WHERE key = '${key.replace(/'/g, "''")}'`))
    const row = result.rows?.[0] as { value: string } | undefined
    return NextResponse.json({ value: row?.value ?? null })
  } catch {
    return NextResponse.json({ value: null })
  }
}

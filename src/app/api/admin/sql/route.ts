import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { sql } = await req.json()
  if (!sql?.trim()) return NextResponse.json({ error: 'No SQL provided' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = text }

    if (!res.ok) return NextResponse.json({ error: typeof json === 'object' ? (json as { message?: string }).message ?? text : text }, { status: res.status })
    return NextResponse.json({ data: json })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

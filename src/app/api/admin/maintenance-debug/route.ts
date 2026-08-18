import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://')
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql: "SELECT value FROM settings WHERE key = 'maintenance_mode' LIMIT 1" } },
        { type: 'close' },
      ],
    }),
  })
  const data = await res.json()
  return NextResponse.json({ status: res.status, data })
}

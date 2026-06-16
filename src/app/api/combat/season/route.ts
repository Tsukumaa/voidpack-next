import { NextResponse } from 'next/server'

// Season is hardcoded for now; update when a seasons table is added
export async function GET() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0, 23, 59, 59)

  return NextResponse.json({
    id:    `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `Saison ${String(month + 1).padStart(2, '0')}/${year}`,
    startAt: start.toISOString(),
    endAt:   end.toISOString(),
    active:  true,
  })
}

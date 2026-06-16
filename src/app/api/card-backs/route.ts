import { NextRequest, NextResponse } from 'next/server'

// Card backs are stored in settings table as JSON, or you can hardcode defaults
// For now return empty list or defaults until card_backs table is migrated
const DEFAULT_BACKS = [
  {
    id: 'default',
    name: 'VOID Pack',
    gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
    pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
    active: true,
    order_index: 0,
  },
]

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const found = DEFAULT_BACKS.find(b => b.id === id)
    return NextResponse.json(found ?? DEFAULT_BACKS[0])
  }

  return NextResponse.json(DEFAULT_BACKS)
}

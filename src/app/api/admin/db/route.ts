import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { action, table, data, eq: eqFilter } = await req.json()
  const sb = getAdminClient()

  try {
    let result

    if (action === 'select') {
      const q = sb.from(table).select(data?.select ?? '*')
      if (data?.order) q.order(data.order)
      result = await q
    } else if (action === 'insert') {
      result = await sb.from(table).insert(data)
    } else if (action === 'update') {
      result = await sb.from(table).update(data).eq(eqFilter.col, eqFilter.val)
    } else if (action === 'delete') {
      result = await sb.from(table).delete().eq(eqFilter.col, eqFilter.val)
    } else if (action === 'upsert') {
      result = await sb.from(table).upsert(data, { onConflict: eqFilter?.onConflict ?? 'id' })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ data: result.data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

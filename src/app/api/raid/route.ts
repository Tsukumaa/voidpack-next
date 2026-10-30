import { NextResponse } from 'next/server'
import { getDisplayRaid, toPublicRaid } from '@/lib/game/raids'

// Raid de boss affiché à tous les joueurs (en cours, ou résultat pendant 48 h).
// Données publiques et identiques pour tous → cache CDN (plus long quand il n'y a pas de raid).
// Le premier appel après la date de fin déclenche la distribution des récompenses.
export async function GET() {
  const raid = await getDisplayRaid()
  return NextResponse.json(raid ? await toPublicRaid(raid) : null, {
    headers: { 'Cache-Control': raid ? 's-maxage=30, stale-while-revalidate=60' : 's-maxage=120, stale-while-revalidate=300' },
  })
}

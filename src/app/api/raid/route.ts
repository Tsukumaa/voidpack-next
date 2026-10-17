import { NextResponse } from 'next/server'
import { getDisplayRaid, toPublicRaid } from '@/lib/game/raids'

// Raid affiché à tous les joueurs (en cours, ou objectif atteint et réclamation ouverte).
// Données publiques et identiques pour tous → cache CDN (plus long quand il n'y a pas de raid).
export async function GET() {
  const raid = await getDisplayRaid()
  return NextResponse.json(raid ? toPublicRaid(raid) : null, {
    headers: { 'Cache-Control': raid ? 's-maxage=30, stale-while-revalidate=60' : 's-maxage=120, stale-while-revalidate=300' },
  })
}

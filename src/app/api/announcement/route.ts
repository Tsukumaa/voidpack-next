import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

// Annonces affichées une seule fois par joueur depuis leur activation :
//  - popup texte (announcement_title / _body / _active_since)
//  - vidéo plein écran (announcement_video_url / _video_since), jouée avant la popup
export async function GET() {
  const rows = await db.select().from(settings)
    .where(inArray(settings.key, [
      'announcement_title', 'announcement_body', 'announcement_active_since',
      'announcement_video_url', 'announcement_video_since',
    ]))

  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const since      = map['announcement_active_since']
  const videoUrl   = map['announcement_video_url']
  const videoSince = map['announcement_video_since']

  return NextResponse.json({
    active: !!since,
    since:  since ?? null,
    title:  map['announcement_title'] ?? '',
    body:   map['announcement_body']  ?? '',
    video:  videoUrl && videoSince ? { url: videoUrl, since: videoSince } : null,
  }, {
    // Identique pour tous les joueurs, appelé à chaque chargement de page
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}

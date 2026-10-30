// Crédits artistes d'une carte. Une carte peut être une collab : plusieurs artistes
// stockés dans les colonnes existantes, séparés par "|" (même ordre pour noms et liens).
//   artist     = "Alice|Bob"
//   artist_url = "https://alice|"   (lien vide = pas de lien pour cet artiste)
// Une carte à un seul artiste garde l'ancien format (aucune migration nécessaire).

export type CardArtist = { name: string; url: string | null }

const SEP = '|'

export function parseArtists(artist?: string | null, artistUrl?: string | null): CardArtist[] {
  if (!artist?.trim()) return []
  const names = artist.split(SEP)
  const urls  = (artistUrl ?? '').split(SEP)
  return names
    .map((n, i) => ({ name: n.trim(), url: urls[i]?.trim() || null }))
    .filter(a => a.name)
}

export function joinArtists(list: CardArtist[]): { artist: string | null; artistUrl: string | null } {
  const clean = list.filter(a => a.name.trim())
  if (!clean.length) return { artist: null, artistUrl: null }
  const urls = clean.map(a => a.url?.trim() ?? '')
  return {
    artist:    clean.map(a => a.name.trim()).join(SEP),
    artistUrl: urls.some(Boolean) ? urls.join(SEP) : null,
  }
}

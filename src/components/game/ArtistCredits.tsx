'use client'
import { Fragment } from 'react'
import { parseArtists } from '@/lib/artists'

// Liste des artistes d'une carte : "Alice & Bob" ou "Alice, Bob & Carol", chacun lié si possible.
export function ArtistNames({ artist, artistUrl }: { artist?: string | null; artistUrl?: string | null }) {
  const list = parseArtists(artist, artistUrl)
  return (
    <>
      {list.map((a, i) => (
        <Fragment key={a.name + i}>
          {i > 0 && (i === list.length - 1 ? ' & ' : ', ')}
          {a.url ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[#a78bfa] hover:text-white underline underline-offset-2 transition-colors">
              {a.name}
            </a>
          ) : (
            <span>{a.name}</span>
          )}
        </Fragment>
      ))}
    </>
  )
}

export function artistLabel(artist?: string | null) {
  return parseArtists(artist).length > 1 ? 'Artistes' : 'Artiste'
}

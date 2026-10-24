'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Volume2 } from 'lucide-react'
import { suppressSiteMusic } from '@/components/layout/MusicPlayer'

// Type de média d'après l'URL : imgg.fr et les extensions image → image (GIF animé compris),
// extensions vidéo → vidéo, sinon inconnu (on tente la vidéo puis on bascule sur l'image).
export function announcementMediaKind(url: string): 'video' | 'image' | 'unknown' {
  const path = url.split(/[?#]/)[0].toLowerCase()
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return 'video'
  if (/\.(gif|png|jpe?g|webp|avif)$/.test(path)) return 'image'
  if (/^https?:\/\/(www\.)?imgg\.fr\//.test(path)) return 'image'
  return 'unknown'
}

// Annonce plein écran (vidéo ou image/GIF), jouée une seule fois par joueur (voir GlobalOverlay).
// Vidéo : les navigateurs bloquent la lecture auto avec le son sans interaction → on tente
// avec le son, sinon lecture muette + bouton "Activer le son". Fermeture auto à la fin.
// Image/GIF : pas de fin détectable → bouton "Fermer".
export function AnnouncementVideo({ src, onDone }: { src: string; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [kind, setKind] = useState<'video' | 'image'>(() => announcementMediaKind(src) === 'image' ? 'image' : 'video')
  const [muted, setMuted] = useState(false)
  const [canSkip, setCanSkip] = useState(false)

  useEffect(() => {
    // Musique du site en pause pendant toute l'annonce (rien ne peut la relancer avant la fin)
    suppressSiteMusic(true)
    // Bouton Passer/Fermer après un court délai, pour éviter de fermer par erreur
    const t = setTimeout(() => setCanSkip(true), 1500)
    return () => { clearTimeout(t); suppressSiteMusic(false) }
  }, [])

  useEffect(() => {
    if (kind !== 'video') return
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {
      // Lecture avec le son refusée → muet
      v.muted = true
      setMuted(true)
      v.play().catch(() => {}) // échec définitif : géré par onError (bascule image) ou le bouton Passer
    })
  }, [kind])

  // Vidéo illisible : si le type était incertain, on retente en image ; sinon on ferme
  function onVideoError() {
    if (announcementMediaKind(src) === 'unknown') setKind('image')
    else onDone()
  }

  function unmute() {
    const v = videoRef.current
    if (!v) return
    v.muted = false
    setMuted(false)
  }

  // Portail dans <body> : le contenu du site est dans un conteneur z-[2], et les boutons
  // globaux (musique, réglages) sont hors de ce conteneur → sans portail ils passent devant
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      {kind === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          onEnded={onDone}
          onError={onVideoError}
          className="w-full h-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={onDone} className="max-w-full max-h-full object-contain select-none" draggable={false} />
      )}

      {kind === 'video' && muted && (
        <button onClick={unmute}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold"
          style={{ background: 'rgba(123,43,255,0.85)', boxShadow: '0 0 20px rgba(123,43,255,0.5)' }}>
          <Volume2 size={16} /> Activer le son
        </button>
      )}

      {canSkip && (
        <button onClick={onDone}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/70 hover:text-white text-xs font-bold transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          {kind === 'video' ? 'Passer' : 'Fermer'} <X size={14} />
        </button>
      )}
    </div>,
    document.body,
  )
}

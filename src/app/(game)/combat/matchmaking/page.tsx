'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Swords } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { joinMatchmaking, leaveMatchmaking } from '@/lib/game/combat-multiplayer'

export default function MatchmakingPage() {
  const router = useRouter()
  const { user } = useGameStore(s => ({ user: s.user }))
  const [status, setStatus] = useState<'loading' | 'waiting' | 'matched' | 'error'>('loading')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError]   = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const joined   = useRef(false)

  useEffect(() => {
    if (!user || joined.current) return
    joined.current = true

    const deckRaw = sessionStorage.getItem('draft_deck')
    if (!deckRaw) { router.replace('/combat/draft'); return }
    const deck = JSON.parse(deckRaw)

    joinMatchmaking(deck, {
      onWaiting: () => {
        setStatus('waiting')
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      },
      onMatched: (data: { session_id: string }) => {
        setStatus('matched')
        clearInterval(timerRef.current!)
        sessionStorage.removeItem('draft_deck')
        setTimeout(() => router.push(`/combat/${data.session_id}`), 800)
      },
    }).catch((e: Error) => {
      setError(e.message)
      setStatus('error')
    })

    return () => {
      clearInterval(timerRef.current!)
    }
  }, [user]) // eslint-disable-line

  async function cancel() {
    await leaveMatchmaking()
    router.back()
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">

      {status === 'loading' && (
        <div className="w-8 h-8 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
      )}

      {status === 'waiting' && (
        <>
          {/* Icône animée */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 flex items-center justify-center"
              style={{ animation: 'boosterFloat 3s ease-in-out infinite' }}>
              <Swords size={40} className="text-[#7b2bff]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#7b2bff]/30 animate-ping" />
          </div>

          <div className="text-center">
            <p className="text-white font-bold text-lg">Recherche d'un adversaire…</p>
            <p className="text-white/40 text-sm mt-1">{fmt(elapsed)}</p>
          </div>

          {/* Deck résumé */}
          <div className="text-white/30 text-xs text-center">
            Deck de 15 cartes prêt
          </div>

          <button onClick={cancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} /> Annuler
          </button>
        </>
      )}

      {status === 'matched' && (
        <>
          <div className="w-24 h-24 rounded-full bg-[#00c896]/10 border border-[#00c896]/30 flex items-center justify-center">
            <Swords size={40} className="text-[#00c896]" />
          </div>
          <div className="text-center">
            <p className="text-[#00c896] font-bold text-lg">Adversaire trouvé !</p>
            <p className="text-white/40 text-sm mt-1">Chargement de la partie…</p>
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="text-center">
          <p className="text-red-400 font-bold">Erreur</p>
          <p className="text-white/40 text-sm mt-1">{error}</p>
          <button onClick={() => router.back()}
            className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white text-sm">
            Retour
          </button>
        </div>
      )}
    </div>
  )
}

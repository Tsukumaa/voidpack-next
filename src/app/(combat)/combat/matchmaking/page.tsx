'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Swords, Sword, Copy, Check } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { joinMatchmaking, leaveMatchmaking } from '@/lib/game/combat-multiplayer'
import { FeatureGate } from '@/components/FeatureGate'

export default function MatchmakingPage() {
  return (
    <FeatureGate featureKey="feature_combat_multiplayer" label="Le combat multijoueur">
      <Suspense><MatchmakingContent /></Suspense>
    </FeatureGate>
  )
}

function MatchmakingContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isFriendly   = searchParams.get('mode') === 'friendly'
  const { user } = useGameStore(s => ({ user: s.user }))

  const [status, setStatus]     = useState<'loading' | 'waiting' | 'waiting_friend' | 'matched' | 'error'>('loading')
  const [elapsed, setElapsed]   = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const joined   = useRef(false)

  useEffect(() => {
    if (!user || joined.current) return
    joined.current = true

    const deckRaw = sessionStorage.getItem('draft_deck')
    if (!deckRaw) { router.replace('/combat/draft'); return }
    const deck = JSON.parse(deckRaw)

    if (isFriendly) {
      startFriendlySession(deck)
    } else {
      startRanked(deck)
    }

    return () => { clearInterval(timerRef.current!) }
  }, [user]) // eslint-disable-line

  async function startRanked(deck: unknown[]) {
    try {
      await joinMatchmaking(deck, {
        onWaiting: () => {
          setStatus('waiting')
          timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
        },
        onMatched: (data: { session_id?: string; session?: { id: string } }) => {
          const sid = data.session_id ?? data.session?.id
          if (!sid) return
          setStatus('matched')
          clearInterval(timerRef.current!)
          sessionStorage.removeItem('draft_deck')
          setTimeout(() => router.push(`/combat/${sid}`), 800)
        },
      })
    } catch (e: unknown) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function startFriendlySession(deck: unknown[]) {
    try {
      const friendRaw = sessionStorage.getItem('challenge_friend')
      const friend = friendRaw ? JSON.parse(friendRaw) as { id: string; username: string } : null

      const res = await fetch('/api/combat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck, ranked: false }),
      })
      if (!res.ok) throw new Error('Impossible de créer la session')
      const sess = await res.json()

      setSessionId(sess.id)

      if (friend) {
        // Message structuré rendu comme une carte avec boutons Accepter/Refuser dans le chat
        await fetch('/api/social/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiverId: friend.id, content: `[[duel:${sess.id}]]` }),
        })
      }

      setStatus('waiting_friend')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

      // Polling pour détecter quand l'ami rejoint
      const pollJoin = setInterval(async () => {
        const r = await fetch(`/api/combat/session/${sess.id}`)
        if (r.ok) {
          const s = await r.json()
          if (s.status === 'active') {
            clearInterval(pollJoin)
            clearInterval(timerRef.current!)
            sessionStorage.removeItem('draft_deck')
            sessionStorage.removeItem('challenge_friend')
            setStatus('matched')
            setTimeout(() => router.push(`/combat/${sess.id}`), 800)
          }
        }
      }, 2000)

    } catch (e: unknown) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function cancel() {
    if (!isFriendly) await leaveMatchmaking()
    else if (sessionId) {
      await fetch(`/api/combat/session/${sessionId}`, { method: 'DELETE' })
    }
    router.back()
  }

  async function copyLink() {
    if (!sessionId) return
    await navigator.clipboard.writeText(`${window.location.origin}/combat/join/${sessionId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">

      {status === 'loading' && (
        <div className="w-8 h-8 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
      )}

      {status === 'waiting' && (
        <>
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 flex items-center justify-center"
              style={{ animation: 'boosterFloat 3s ease-in-out infinite' }}>
              <Swords size={40} className="text-[#7b2bff]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#7b2bff]/30 animate-ping" />
          </div>
          <div className="text-center">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff9a3d]/10 border border-[#ff9a3d]/30 text-[#ff9a3d] mb-3 inline-block">Ranked</span>
            <p className="text-white font-bold text-lg mt-2">Recherche d'un adversaire…</p>
            <p className="text-white/40 text-sm mt-1">{fmt(elapsed)}</p>
          </div>
          <button onClick={cancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} /> Annuler
          </button>
        </>
      )}

      {status === 'waiting_friend' && (
        <>
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 flex items-center justify-center"
              style={{ animation: 'boosterFloat 3s ease-in-out infinite' }}>
              <Sword size={40} className="text-[#a78bfa]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#7b2bff]/20 animate-ping" />
          </div>
          <div className="text-center">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] mb-3 inline-block">Partie amicale</span>
            <p className="text-white font-bold text-lg mt-2">En attente de ton ami…</p>
            <p className="text-white/40 text-sm mt-1">{fmt(elapsed)} · Invitation envoyée par message</p>
          </div>
          <button onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm transition-colors">
            {copied ? <Check size={14} className="text-[#4a9e6a]" /> : <Copy size={14} />}
            {copied ? 'Lien copié !' : 'Copier le lien d\'invitation'}
          </button>
          <button onClick={cancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} /> Annuler
          </button>
        </>
      )}

      {status === 'matched' && (
        <>
          <div className="w-24 h-24 rounded-full bg-[#4a9e6a]/10 border border-[#4a9e6a]/30 flex items-center justify-center">
            <Swords size={40} className="text-[#4a9e6a]" />
          </div>
          <div className="text-center">
            <p className="text-[#4a9e6a] font-bold text-lg">Adversaire trouvé !</p>
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

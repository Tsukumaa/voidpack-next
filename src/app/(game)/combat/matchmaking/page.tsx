'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Swords, Sword, Copy, Check } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { joinMatchmaking, leaveMatchmaking } from '@/lib/game/combat-multiplayer'
import { createClient } from '@/lib/supabase/client'

export default function MatchmakingPage() {
  return <Suspense><MatchmakingContent /></Suspense>
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
        onMatched: (data: { session_id: string }) => {
          setStatus('matched')
          clearInterval(timerRef.current!)
          sessionStorage.removeItem('draft_deck')
          setTimeout(() => router.push(`/combat/${data.session_id}`), 800)
        },
      })
    } catch (e: unknown) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function startFriendlySession(deck: unknown[]) {
    try {
      const sb = createClient()
      const friendRaw = sessionStorage.getItem('challenge_friend')
      const friend = friendRaw ? JSON.parse(friendRaw) as { id: string; username: string } : null

      // Créer une session privée en attente
      const { data: sess, error: sessErr } = await sb
        .from('game_sessions')
        .insert({
          player1_id: user!.id,
          status: 'waiting',
          state: {
            p1_hp: 30, p2_hp: 30,
            p1_mana: 1, p1_max_mana: 1,
            p2_mana: 0, p2_max_mana: 0,
            p1_board: [], p2_board: [],
            p1_deck: deck, p2_deck: [],
            p1_hand: [], p2_hand: [],
            turn: 1, ranked: false,
          },
        })
        .select('id')
        .single()

      if (sessErr || !sess) throw new Error('Impossible de créer la session')

      setSessionId(sess.id)

      // Envoyer DM à l'ami avec le lien
      if (friend) {
        const joinUrl = `${window.location.origin}/combat/join/${sess.id}`
        await sb.from('direct_messages').insert({
          sender_id: user!.id,
          receiver_id: friend.id,
          content: `⚔️ Je te défie en partie amicale ! Rejoins ici : ${joinUrl}`,
        })
      }

      setStatus('waiting_friend')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

      // Écouter quand l'ami rejoint
      sb.channel(`friendly:${sess.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'game_sessions',
          filter: `id=eq.${sess.id}`,
        }, (payload) => {
          if (payload.new.status === 'active') {
            clearInterval(timerRef.current!)
            sessionStorage.removeItem('draft_deck')
            sessionStorage.removeItem('challenge_friend')
            setStatus('matched')
            setTimeout(() => router.push(`/combat/${sess.id}`), 800)
          }
        })
        .subscribe()

    } catch (e: unknown) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function cancel() {
    if (!isFriendly) await leaveMatchmaking()
    else if (sessionId) {
      await createClient().from('game_sessions').delete().eq('id', sessionId)
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
            {copied ? <Check size={14} className="text-[#00c896]" /> : <Copy size={14} />}
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

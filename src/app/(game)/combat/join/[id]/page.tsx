'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sword } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useGameStore(s => ({ user: s.user }))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    createClient()
      .from('game_sessions')
      .select('id, status, player1_id')
      .eq('id', id)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError('Session introuvable'); setStatus('error'); return }
        if (data.player1_id === user.id) { router.replace(`/combat/${id}`); return }
        if (data.status !== 'waiting') { setError('Cette partie a déjà commencé'); setStatus('error'); return }
        setStatus('ready')
      })
  }, [user, id]) // eslint-disable-line

  async function join() {
    if (!user) return
    const deckRaw = sessionStorage.getItem('draft_deck')
    if (!deckRaw) { router.push(`/combat/draft?mode=friendly&join=${id}`); return }
    const deck = JSON.parse(deckRaw)

    const sb = createClient()
    const { error: e } = await sb.from('game_sessions').update({
      player2_id: user.id,
      status: 'active',
      current_turn: null, // le serveur détermine qui commence
      state: sb.rpc ? undefined : undefined, // on update via RPC idéalement
    }).eq('id', id).eq('status', 'waiting')

    if (e) { setError('Impossible de rejoindre'); return }

    // Mettre à jour le state avec le deck p2
    await sb.from('game_sessions').select('state').eq('id', id).single().then(async ({ data }) => {
      if (!data) return
      const newState = { ...data.state, p2_deck: deck, p2_hand: [], p2_board: [] }
      await sb.from('game_sessions').update({
        player2_id: user.id,
        status: 'active',
        current_turn: data.state.p1_id ?? user.id,
        state: newState,
      }).eq('id', id)
    })

    sessionStorage.removeItem('draft_deck')
    router.push(`/combat/${id}`)
  }

  if (!user) return (
    <div className="flex items-center justify-center min-h-[60vh] text-white/40 text-sm">
      Connecte-toi pour rejoindre la partie.
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-20 h-20 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 flex items-center justify-center">
        <Sword size={36} className="text-[#a78bfa]" />
      </div>

      {status === 'loading' && (
        <div className="w-6 h-6 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
      )}

      {status === 'ready' && (
        <>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Défi reçu !</p>
            <p className="text-white/40 text-sm mt-1">Partie amicale · Pas de gain d'elo</p>
          </div>
          <button onClick={join}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
            <Sword size={16} /> Construire mon deck et rejoindre
          </button>
        </>
      )}

      {status === 'error' && (
        <div className="text-center">
          <p className="text-red-400 font-bold">{error}</p>
          <button onClick={() => router.push('/communaute')}
            className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white text-sm">
            Retour
          </button>
        </div>
      )}
    </div>
  )
}

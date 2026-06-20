'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CombatArena, type ArenaCard } from '@/components/game/CombatArena'
import { useArenaBg } from '@/lib/game/useArenaBg'
import { Eye } from 'lucide-react'

interface GameState {
  p1_hp: number; p2_hp: number
  p1_mana: number; p1_max_mana: number
  p2_mana: number; p2_max_mana: number
  p1_board: ArenaCard[]; p2_board: ArenaCard[]
  p1_hand: ArenaCard[]; p2_hand: ArenaCard[]
  winner?: string
  [key: string]: unknown
}

interface SessionData {
  id: string
  player1Id: string
  player2Id: string | null
  player1Username: string | null
  player2Username: string | null
  player1Avatar: string | null
  player2Avatar: string | null
  status: string
  currentTurn: string | null
  state: string | GameState
  winner?: string | null
  winnerId?: string | null
}

export default function SpectatePage() {
  const { id } = useParams<{ id: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const focusedId    = searchParams.get('p') // l'ami qu'on suit
  const arenaBg = useArenaBg()

  const [session, setSession]   = useState<SessionData | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading]   = useState(true)
  const [gameOver, setGameOver] = useState<{ winnerId: string; winnerName: string } | null>(null)

  const parseSession = useCallback((data: SessionData) => {
    setSession(data)
    const state = typeof data.state === 'string' ? JSON.parse(data.state) : data.state
    setGameState(state)
    if (state?.winner || data.status === 'finished') {
      const wid = state?.winner ?? data.winnerId ?? ''
      const wname = wid === data.player1Id ? (data.player1Username ?? 'Joueur 1')
                  : wid === data.player2Id ? (data.player2Username ?? 'Joueur 2')
                  : 'Inconnu'
      setGameOver({ winnerId: wid, winnerName: wname })
    }
  }, [])

  useEffect(() => {
    fetch(`/api/combat/session/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoading(false); return }
        parseSession(data)
        setLoading(false)
      })
  }, [id, parseSession])

  // Polling toutes les 2s
  useEffect(() => {
    if (gameOver) return
    const interval = setInterval(() => {
      fetch(`/api/combat/session/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) parseSession(data) })
    }, 2000)
    return () => clearInterval(interval)
  }, [id, gameOver, parseSession])

  const s = gameState as Record<string, unknown> | null

  // Orientation : l'ami suivi est "my" (bas), l'autre est "opp" (haut)
  // Si pas de ?p= ou introuvable → p1 en bas par défaut
  const focusIsP2 = session && focusedId === session.player2Id
  const me  = focusIsP2 ? 'p2' : 'p1'
  const opp = focusIsP2 ? 'p1' : 'p2'

  const myHp    = (s?.[`${me}_hp`]  as number) ?? 30
  const oppHp   = (s?.[`${opp}_hp`] as number) ?? 30
  const myMana  = (s?.[`${me}_mana`]     as number) ?? 0
  const myMax   = (s?.[`${me}_max_mana`] as number) ?? 0
  const myBoard  = (s?.[`${me}_board`]  as ArenaCard[]) ?? []
  const oppBoard = (s?.[`${opp}_board`] as ArenaCard[]) ?? []
  const myHand   = (s?.[`${me}_hand`]   as ArenaCard[]) ?? []

  const myName   = (focusIsP2 ? session?.player2Username : session?.player1Username) ?? 'Joueur'
  const oppName  = (focusIsP2 ? session?.player1Username : session?.player2Username) ?? 'Adversaire'
  const myAvatar  = (focusIsP2 ? session?.player2Avatar : session?.player1Avatar) ?? null
  const oppAvatar = (focusIsP2 ? session?.player1Avatar : session?.player2Avatar) ?? null

  const isP1Turn = session?.currentTurn === session?.player1Id

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#030308]">
      <div className="w-10 h-10 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030308] gap-4">
      <p className="text-white/40">Partie introuvable.</p>
      <button onClick={() => router.push('/communaute')}
        className="px-5 py-2.5 rounded-xl bg-[#7b2bff] text-white font-bold text-sm">
        Retour
      </button>
    </div>
  )

  if (gameOver) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030308] gap-6 px-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #1a0a3a44, #030308)' }}>
      <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
        <Eye size={14} /> Mode spectateur
      </div>
      <div className="text-5xl font-black text-[#4a9e6a]">
        {gameOver.winnerName} gagne !
      </div>
      <button onClick={() => router.push('/communaute')}
        className="px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
        Retour à la communauté
      </button>
    </div>
  )

  return (
    <div className="relative">
      {/* Badge spectateur */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white/50 text-xs font-bold backdrop-blur-sm pointer-events-none">
        <Eye size={11} /> Spectateur
      </div>

      <CombatArena
        myHp={myHp}
        oppHp={oppHp}
        myMana={myMana}
        myMaxMana={myMax}
        myBoard={myBoard}
        oppBoard={oppBoard}
        myHand={myHand}
        myName={myName}
        oppName={oppName}
        myAvatar={myAvatar}
        oppAvatar={oppAvatar}
        arenaBg={arenaBg}
        myTurn={false}
        locked={true}
        turnLabel={isP1Turn
          ? `Tour de ${session.player1Username ?? 'Joueur 1'}`
          : `Tour de ${session.player2Username ?? 'Joueur 2'}`}
        onPlayCard={() => {}}
        onAttack={() => {}}
        onEndTurn={() => {}}
        onSurrender={() => router.push('/communaute')}
        log=""
      />
    </div>
  )
}

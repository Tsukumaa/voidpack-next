'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game'
import { CombatArena, type ArenaCard } from '@/components/game/CombatArena'
import {
  onSessionUpdate, onOpponentAction, submitAction,
  endTurn, surrender, finishGame, cleanupSession,
  getMyRole, isMyTurn, initSession,
} from '@/lib/game/combat-multiplayer'

interface GameState {
  p1_hp: number; p2_hp: number
  p1_mana: number; p1_max_mana: number
  p2_mana: number; p2_max_mana: number
  p1_board: ArenaCard[]; p2_board: ArenaCard[]
  p1_hand: ArenaCard[]; p2_hand: ArenaCard[]
  p1_deck?: ArenaCard[]; p2_deck?: ArenaCard[]
  turn: number
  winner?: string
  [key: string]: unknown
}

export default function CombatPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { user, profile } = useGameStore(s => ({ user: s.user, profile: s.profile }))

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [session, setSession]     = useState<Record<string, unknown> | null>(null)
  const [myTurn, setMyTurn]       = useState(false)
  const [role, setRole]           = useState<'player1' | 'player2' | null>(null)
  const [loading, setLoading]     = useState(true)
  const [gameOver, setGameOver]   = useState<{ winner: string } | null>(null)
  const [log, setLog]             = useState<string[]>([])

  const addLog = useCallback((msg: string) => setLog(l => [msg, ...l].slice(0, 30)), [])

  const syncState = useCallback((sess: Record<string, unknown>) => {
    const state = sess.state as GameState
    setSession(sess)
    setGameState(state)
    setMyTurn(isMyTurn())
    setRole(getMyRole())
    if (state?.winner) setGameOver({ winner: state.winner })
  }, [])

  useEffect(() => {
    if (!user) return

    fetch(`/api/combat/session/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        // Init le module multiplayer avec la session (rôle + polling)
        initSession(data, user.id)

        // Distribuer les mains si elles sont vides (début de partie)
        const state = typeof data.state === 'string' ? JSON.parse(data.state) : data.state
        const myRole = data.player1_id === user.id ? 'p1' : 'p2'
        const oppRole = myRole === 'p1' ? 'p2' : 'p1'

        // Seul player1 distribue les mains (évite la race condition)
        const isPlayer1 = data.player1_id === user.id
        if (isPlayer1 && (state.p1_hand?.length ?? 0) === 0 && (state.p1_deck?.length ?? 0) > 0) {
          const p1Deck = [...(state.p1_deck ?? [])]
          const p2Deck = [...(state.p2_deck ?? [])]
          const draw = (deck: ArenaCard[], n: number) => {
            const hand = deck.splice(0, n).map((c: ArenaCard, i: number) => ({ ...c, uid: `${c.id}_${Date.now()}_${i}` }))
            return { hand, deck }
          }
          const p1 = draw(p1Deck, 4)
          const p2 = draw(p2Deck, 4)
          const newState = {
            ...state,
            p1_hand: p1.hand, p1_deck: p1.deck,
            p2_hand: p2.hand, p2_deck: p2.deck,
          }
          fetch(`/api/combat/session/${id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionType: 'deal_hands', payload: {}, newState }),
          }).catch(() => {})
          syncState({ ...data, state: newState })
        } else {
          syncState(data)
        }
        setLoading(false)
      })

    onSessionUpdate((sess: Record<string, unknown>) => syncState(sess))
    onOpponentAction((action: { action_type: string }) => addLog(`Adversaire : ${action.action_type}`))
    return () => { cleanupSession() }
  }, [user, id, syncState, addLog])

  const me  = role === 'player1' ? 'p1' : 'p2'
  const opp = role === 'player1' ? 'p2' : 'p1'

  const s = gameState as Record<string, unknown> | null
  const myHp      = (s?.[`${me}_hp`]  as number) ?? 30
  const oppHp     = (s?.[`${opp}_hp`] as number) ?? 30
  const myMana    = (s?.[`${me}_mana`]     as number) ?? 0
  const myMaxMana = (s?.[`${me}_max_mana`] as number) ?? 0
  const myBoard   = (s?.[`${me}_board`]  as ArenaCard[]) ?? []
  const oppBoard  = (s?.[`${opp}_board`] as ArenaCard[]) ?? []
  const myHand    = (s?.[`${me}_hand`]   as ArenaCard[]) ?? []
  const myDeck    = (s?.[`${me}_deck`]   as ArenaCard[]) ?? []
  const oppHand   = (s?.[`${opp}_hand`]  as ArenaCard[]) ?? []

  async function playCard(card: ArenaCard) {
    if (!myTurn || !gameState) return
    if (card.cost > myMana) { addLog('Pas assez de mana'); return }
    const newHand  = myHand.filter(c => c.uid !== card.uid)
    const newBoard = [...myBoard, { ...card, exhausted: true }]
    const newState = { ...gameState, [`${me}_hand`]: newHand, [`${me}_board`]: newBoard, [`${me}_mana`]: myMana - card.cost }
    setGameState(newState)
    addLog(`Tu joues ${card.name}`)
    await submitAction('play_card', { card_id: card.uid }, newState as unknown as null)
  }

  async function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    if (!myTurn || !gameState || attacker.exhausted) return
    let newState = { ...gameState }
    if (target === 'face') {
      const newOppHp = Math.max(0, oppHp - attacker.atk)
      newState = { ...newState, [`${opp}_hp`]: newOppHp }
      addLog(`${attacker.name} attaque l'adversaire pour ${attacker.atk}`)
      if (newOppHp <= 0 && user) {
        newState = { ...newState, winner: user.id }
        setGameState(newState)
        await finishGame(user.id)
        setGameOver({ winner: user.id })
        return
      }
    } else {
      const newTargetHp = target.currentHp - attacker.atk
      const newAttHp    = attacker.currentHp - target.atk
      const newOppBoard = newTargetHp <= 0 ? oppBoard.filter(c => c.uid !== target.uid) : oppBoard.map(c => c.uid === target.uid ? { ...c, currentHp: newTargetHp } : c)
      const newMyBoard  = newAttHp <= 0 ? myBoard.filter(c => c.uid !== attacker.uid) : myBoard.map(c => c.uid === attacker.uid ? { ...c, currentHp: newAttHp, exhausted: true } : c)
      newState = { ...newState, [`${me}_board`]: newMyBoard, [`${opp}_board`]: newOppBoard }
      addLog(`${attacker.name} attaque ${target.name}`)
    }
    const updatedMyBoard = (newState as Record<string, ArenaCard[]>)[`${me}_board`]?.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
    newState = { ...newState, [`${me}_board`]: updatedMyBoard }
    setGameState(newState)
    await submitAction('attack', { attacker: attacker.uid, target: target === 'face' ? 'face' : target.uid }, newState as unknown as null)
  }

  async function handleEndTurn() {
    if (!myTurn || !gameState) return
    const newMaxMana = Math.min(10, myMaxMana + 1)
    const newState = {
      ...gameState,
      [`${opp}_mana`]: Math.min(10, (gameState as Record<string, number>)[`${opp}_max_mana`] + 1),
      [`${opp}_max_mana`]: Math.min(10, (gameState as Record<string, number>)[`${opp}_max_mana`] + 1),
      [`${me}_board`]: myBoard.map(c => ({ ...c, exhausted: false })),
    }
    setGameState(newState)
    addLog('Fin de ton tour')
    await endTurn(newState)
  }

  async function handleSurrender() {
    if (!confirm('Abandonner la partie ?')) return
    await surrender()
    router.push('/communaute')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#030308]">
      <div className="w-10 h-10 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gameOver) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030308] gap-6 px-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #1a0a3a44, #030308)' }}>
      <div className={`text-5xl font-black ${gameOver.winner === user?.id ? 'text-[#00c896]' : 'text-[#ff4757]'}`}>
        {gameOver.winner === user?.id ? 'Victoire !' : 'Défaite'}
      </div>
      <div className="flex gap-3">
        <button onClick={() => router.push('/communaute')}
          className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold hover:bg-white/10 transition-colors">
          Communauté
        </button>
        <button onClick={() => router.push('/combat/draft')}
          className="px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
          Nouveau match
        </button>
      </div>
    </div>
  )

  const oppName = session
    ? (role === 'player1'
      ? (session as Record<string, unknown>).player2_username as string | undefined
      : (session as Record<string, unknown>).player1_username as string | undefined)
    : undefined

  return (
    <CombatArena
      myHp={myHp} oppHp={oppHp}
      myMana={myMana} myMaxMana={myMaxMana}
      myBoard={myBoard} oppBoard={oppBoard}
      myHand={myHand}
      myDeckCount={myDeck.length}
      oppHandCount={oppHand.length}
      myName={profile?.username ?? 'Moi'}
      oppName={oppName ?? 'Adversaire'}
      myAvatar={profile?.avatar_url ?? null}
      myTurn={myTurn}
      onPlayCard={playCard}
      onAttack={handleAttack}
      onEndTurn={handleEndTurn}
      onSurrender={handleSurrender}
      log={log}
    />
  )
}

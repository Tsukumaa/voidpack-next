'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Flag, Zap, Heart, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import {
  onSessionUpdate, onOpponentAction, submitAction,
  endTurn, surrender, finishGame, cleanupSession,
  getMyRole, isMyTurn, getSession,
} from '@/lib/game/combat-multiplayer'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}

interface BoardCard {
  uid: string; id: string; name: string; rarity: string
  atk: number; hp: number; currentHp: number; cost: number
  exhausted: boolean; image_url?: string
}

interface GameState {
  p1_hp: number; p2_hp: number
  p1_mana: number; p1_max_mana: number
  p2_mana: number; p2_max_mana: number
  p1_board: BoardCard[]; p2_board: BoardCard[]
  p1_hand: BoardCard[]; p2_hand: BoardCard[]
  turn: number
  winner?: string
}

export default function CombatPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { user } = useGameStore(s => ({ user: s.user }))

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [session, setSession]     = useState<Record<string, unknown> | null>(null)
  const [myTurn, setMyTurn]       = useState(false)
  const [role, setRole]           = useState<'player1' | 'player2' | null>(null)
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [gameOver, setGameOver]   = useState<{ winner: string } | null>(null)
  const [log, setLog]             = useState<string[]>([])

  const addLog = (msg: string) => setLog(l => [msg, ...l].slice(0, 20))

  const syncState = useCallback((sess: Record<string, unknown>) => {
    const state = sess.state as GameState
    setSession(sess)
    setGameState(state)
    setMyTurn(isMyTurn())
    setRole(getMyRole())
    if (state?.winner) {
      setGameOver({ winner: state.winner })
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const sb = createClient()
    sb.from('game_sessions').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        syncState(data)
        setLoading(false)
      }
    })

    onSessionUpdate((sess: Record<string, unknown>) => {
      syncState(sess)
    })

    onOpponentAction((action: { action_type: string; payload: Record<string, unknown> }) => {
      addLog(`Adversaire : ${action.action_type}`)
    })

    return () => { cleanupSession() }
  }, [user, id, syncState])

  const me = role === 'player1' ? 'p1' : 'p2'
  const opp = role === 'player1' ? 'p2' : 'p1'

  const myHp      = gameState ? (gameState as Record<string, number>)[`${me}_hp`] : 30
  const oppHp     = gameState ? (gameState as Record<string, number>)[`${opp}_hp`] : 30
  const myMana    = gameState ? (gameState as Record<string, number>)[`${me}_mana`] : 0
  const myMaxMana = gameState ? (gameState as Record<string, number>)[`${me}_max_mana`] : 0
  const myBoard   = (gameState as Record<string, BoardCard[]> | null)?.[`${me}_board`] ?? []
  const oppBoard  = (gameState as Record<string, BoardCard[]> | null)?.[`${opp}_board`] ?? []
  const myHand    = (gameState as Record<string, BoardCard[]> | null)?.[`${me}_hand`] ?? []

  async function playCard(card: BoardCard) {
    if (!myTurn || !gameState) return
    if (card.cost > myMana) { addLog('Pas assez de mana'); return }

    const newHand  = myHand.filter(c => c.uid !== card.uid)
    const newBoard = [...myBoard, { ...card, exhausted: true }]
    const newMana  = myMana - card.cost

    const newState = {
      ...gameState,
      [`${me}_hand`]:  newHand,
      [`${me}_board`]: newBoard,
      [`${me}_mana`]:  newMana,
    }

    setGameState(newState)
    addLog(`Tu joues ${card.name}`)
    await submitAction('play_card', { card_id: card.uid }, newState)
    setSelectedCard(null)
  }

  async function attackWithCard(attacker: BoardCard, target: BoardCard | 'face') {
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
      const newTargetHp  = target.currentHp - attacker.atk
      const newAttHp     = attacker.currentHp - target.atk
      const newOppBoard  = newTargetHp <= 0
        ? oppBoard.filter(c => c.uid !== target.uid)
        : oppBoard.map(c => c.uid === target.uid ? { ...c, currentHp: newTargetHp } : c)
      const newMyBoard   = newAttHp <= 0
        ? myBoard.filter(c => c.uid !== attacker.uid)
        : myBoard.map(c => c.uid === attacker.uid ? { ...c, currentHp: newAttHp, exhausted: true } : c)

      newState = { ...newState, [`${me}_board`]: newMyBoard, [`${opp}_board`]: newOppBoard }
      addLog(`${attacker.name} attaque ${target.name}`)
    }

    const updatedMyBoard = (newState as Record<string, BoardCard[]>)[`${me}_board`]
      ?.map((c: BoardCard) => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
    newState = { ...newState, [`${me}_board`]: updatedMyBoard }

    setGameState(newState)
    setSelectedCard(null)
    await submitAction('attack', { attacker: attacker.uid, target: target === 'face' ? 'face' : target.uid }, newState)
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
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gameOver) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className={cn('text-4xl font-black', gameOver.winner === user?.id ? 'text-[#00c896]' : 'text-red-400')}>
        {gameOver.winner === user?.id ? 'Victoire !' : 'Défaite'}
      </div>
      <button onClick={() => router.push('/communaute')}
        className="px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
        Retour à la communauté
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 pb-4 select-none">

      {/* ── Adversaire ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/50 text-xs font-bold">Adversaire</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#ff6b6b] text-xs font-bold">
              <Heart size={12} /> {oppHp}
            </span>
            <span className="text-white/30 text-xs">{oppBoard.length} cartes</span>
          </div>
        </div>
        {/* Board adversaire */}
        <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
          {oppBoard.length === 0 ? (
            <span className="text-white/20 text-xs w-full text-center">Plateau vide</span>
          ) : oppBoard.map(card => (
            <button key={card.uid}
              onClick={() => selectedCard && attackWithCard(selectedCard, card)}
              className={cn(
                'relative w-14 rounded-xl overflow-hidden border transition-all',
                selectedCard ? 'border-[#ff6b6b]/60 hover:border-[#ff6b6b] hover:scale-105' : 'border-white/10'
              )}>
              <div className="aspect-[0.714] relative" style={{ background: 'linear-gradient(135deg,#1a0a2e,#0a0518)' }}>
                {card.image_url && <Image src={card.image_url} alt={card.name} fill className="object-contain" unoptimized />}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5">
                  <span className="text-[8px] font-black text-[#ff6b6b] bg-black/70 rounded px-0.5">{card.atk}</span>
                  <span className="text-[8px] font-black text-[#00c896] bg-black/70 rounded px-0.5">{card.currentHp}</span>
                </div>
              </div>
              <div className="px-1 py-0.5 bg-black/40">
                <p className="text-[8px] font-bold text-white truncate">{card.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Zone centrale attaque face ── */}
      {selectedCard && myTurn && (
        <button onClick={() => attackWithCard(selectedCard, 'face')}
          className="w-full py-2 rounded-xl bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 text-[#ff6b6b] text-xs font-bold hover:bg-[#ff6b6b]/20 transition-colors">
          ⚔ Attaquer l'adversaire directement ({selectedCard.atk} dégâts)
        </button>
      )}

      {/* ── Mon board ── */}
      <div className="rounded-2xl bg-[#7b2bff]/[0.04] border border-[#7b2bff]/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#a78bfa] text-xs font-bold">Mon plateau</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#ff6b6b] text-xs font-bold">
              <Heart size={12} /> {myHp}
            </span>
            <span className="flex items-center gap-1 text-[#4aa3ff] text-xs font-bold">
              <Zap size={12} /> {myMana}/{myMaxMana}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
          {myBoard.length === 0 ? (
            <span className="text-white/20 text-xs w-full text-center">Pose une carte depuis ta main</span>
          ) : myBoard.map(card => (
            <button key={card.uid}
              onClick={() => myTurn && !card.exhausted && setSelectedCard(selectedCard?.uid === card.uid ? null : card)}
              className={cn(
                'relative w-14 rounded-xl overflow-hidden border-2 transition-all',
                selectedCard?.uid === card.uid ? 'border-[#7b2bff] scale-105' : 'border-transparent',
                card.exhausted ? 'opacity-40' : myTurn ? 'hover:border-white/30' : ''
              )}>
              <div className="aspect-[0.714] relative" style={{ background: 'linear-gradient(135deg,#1a0a3a,#0d051f)' }}>
                {card.image_url && <Image src={card.image_url} alt={card.name} fill className="object-contain" unoptimized />}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5">
                  <span className="text-[8px] font-black text-[#ff6b6b] bg-black/70 rounded px-0.5">{card.atk}</span>
                  <span className="text-[8px] font-black text-[#00c896] bg-black/70 rounded px-0.5">{card.currentHp}</span>
                </div>
                {card.exhausted && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Shield size={16} className="text-white/40" />
                  </div>
                )}
              </div>
              <div className="px-1 py-0.5 bg-black/40">
                <p className="text-[8px] font-bold text-white truncate">{card.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main + actions ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/50 text-xs font-bold">Ma main ({myHand.length})</span>
          <div className="flex gap-2">
            <button onClick={handleEndTurn} disabled={!myTurn}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                myTurn ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0]' : 'bg-white/5 text-white/20 cursor-not-allowed')}>
              {myTurn ? 'Fin de tour' : 'Tour adversaire'}
            </button>
            <button onClick={handleSurrender}
              className="px-2 py-1.5 rounded-xl bg-red-900/20 text-red-400 text-xs hover:bg-red-900/40 transition-colors">
              <Flag size={12} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {myHand.length === 0 ? (
            <span className="text-white/20 text-xs">Main vide</span>
          ) : myHand.map(card => (
            <button key={card.uid}
              onClick={() => myTurn && playCard(card)}
              disabled={!myTurn || card.cost > myMana}
              className={cn(
                'relative flex-shrink-0 w-16 rounded-xl overflow-hidden border-2 transition-all',
                !myTurn || card.cost > myMana ? 'opacity-40 cursor-not-allowed border-transparent' : 'border-transparent hover:border-[#7b2bff] hover:scale-105'
              )}>
              <div className="aspect-[0.714] relative" style={{ background: 'linear-gradient(135deg,#1a0a2e,#0a0518)' }}>
                {card.image_url && <Image src={card.image_url} alt={card.name} fill className="object-contain" unoptimized />}
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#4aa3ff]/80 flex items-center justify-center text-[9px] font-black text-white">
                  {card.cost}
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5">
                  <span className="text-[8px] font-black text-[#ff6b6b] bg-black/70 rounded px-0.5">{card.atk}</span>
                  <span className="text-[8px] font-black text-[#00c896] bg-black/70 rounded px-0.5">{card.hp}</span>
                </div>
              </div>
              <div className="px-1 py-0.5 bg-black/40">
                <p className="text-[8px] font-bold text-white truncate">{card.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Log ── */}
      {log.length > 0 && (
        <div className="rounded-xl bg-black/20 border border-white/[0.04] p-2 max-h-24 overflow-y-auto">
          {log.map((l, i) => (
            <p key={i} className="text-white/30 text-[10px]">{l}</p>
          ))}
        </div>
      )}
    </div>
  )
}

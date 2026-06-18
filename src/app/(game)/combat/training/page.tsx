'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Flag, Zap, Heart, Shield, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}

interface BoardCard {
  uid: string
  id: string
  name: string
  rarity: string
  atk: number
  hp: number
  currentHp: number
  cost: number
  exhausted: boolean
  image_url?: string | null
}

interface GameState {
  p1_hp: number; p2_hp: number
  p1_mana: number; p1_max_mana: number
  p2_mana: number; p2_max_mana: number
  p1_board: BoardCard[]; p2_board: BoardCard[]
  p1_hand: BoardCard[]; p2_hand: BoardCard[]
  p1_deck: BoardCard[]; p2_deck: BoardCard[]
  turn: number
  myTurn: boolean
  winner?: 'player' | 'bot'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawCards(hand: BoardCard[], deck: BoardCard[], n: number): { hand: BoardCard[]; deck: BoardCard[] } {
  const drawn = deck.slice(0, n)
  return { hand: [...hand, ...drawn], deck: deck.slice(n) }
}

function buildBotDeck(cards: { id: string; name: string; rarity: string; image_url: string | null; metadata: Record<string, unknown> }[]): BoardCard[] {
  const RARITY_COPIES: Record<string, number> = { void: 1, legendary: 1, epic: 2, rare: 3, common: 4 }
  const pool: BoardCard[] = []
  for (const c of shuffle(cards).slice(0, 20)) {
    const combat = (c.metadata?.combat ?? { atk: 1, hp: 2, cost: 2 }) as { atk: number; hp: number; cost: number }
    const copies = RARITY_COPIES[c.rarity] ?? 1
    for (let i = 0; i < copies; i++) {
      pool.push({
        uid: `bot_${c.id}_${i}`, id: c.id, name: c.name, rarity: c.rarity,
        atk: combat.atk ?? 1, hp: combat.hp ?? 2, currentHp: combat.hp ?? 2,
        cost: combat.cost ?? 2, exhausted: false, image_url: c.image_url,
      })
    }
  }
  return shuffle(pool).slice(0, 24)
}

// ── Bot AI ────────────────────────────────────────────────────────────────────
function botPlayTurn(state: GameState): GameState {
  let s = { ...state }

  // Draw
  if (s.p2_deck.length > 0) {
    const { hand, deck } = drawCards(s.p2_hand, s.p2_deck, 1)
    s = { ...s, p2_hand: hand, p2_deck: deck }
  }

  // Refresh mana
  const newMaxMana = Math.min(10, s.p2_max_mana + 1)
  s = { ...s, p2_mana: newMaxMana, p2_max_mana: newMaxMana }

  // Play cards greedily (most expensive first)
  const sorted = [...s.p2_hand].sort((a, b) => b.cost - a.cost)
  for (const card of sorted) {
    if (card.cost <= s.p2_mana && s.p2_board.length < 6) {
      s = {
        ...s,
        p2_hand: s.p2_hand.filter(c => c.uid !== card.uid),
        p2_board: [...s.p2_board, { ...card, exhausted: false }],
        p2_mana: s.p2_mana - card.cost,
      }
    }
  }

  // Attack
  for (const attacker of s.p2_board.filter(c => !c.exhausted)) {
    if (s.p1_board.length > 0) {
      // Attack weakest player card
      const target = [...s.p1_board].sort((a, b) => a.currentHp - b.currentHp)[0]
      const newTargetHp = target.currentHp - attacker.atk
      const newAttHp = attacker.currentHp - target.atk
      const newP1Board = newTargetHp <= 0
        ? s.p1_board.filter(c => c.uid !== target.uid)
        : s.p1_board.map(c => c.uid === target.uid ? { ...c, currentHp: newTargetHp } : c)
      const newP2Board = newAttHp <= 0
        ? s.p2_board.filter(c => c.uid !== attacker.uid)
        : s.p2_board.map(c => c.uid === attacker.uid ? { ...c, currentHp: newAttHp, exhausted: true } : c)
      s = { ...s, p1_board: newP1Board, p2_board: newP2Board }
    } else {
      // Attack face
      const newP1Hp = Math.max(0, s.p1_hp - attacker.atk)
      s = {
        ...s,
        p1_hp: newP1Hp,
        p2_board: s.p2_board.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c),
      }
      if (newP1Hp <= 0) {
        return { ...s, winner: 'bot' }
      }
    }
  }

  return s
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  return <Suspense><TrainingContent /></Suspense>
}

function TrainingContent() {
  const router = useRouter()
  const [gs, setGs] = useState<GameState | null>(null)
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [botThinking, setBotThinking] = useState(false)
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLog = useCallback((msg: string) => setLog(l => [msg, ...l].slice(0, 30)), [])

  // Init
  useEffect(() => {
    async function init() {
      const raw = sessionStorage.getItem('draft_deck')
      if (!raw) { router.push('/combat/draft'); return }

      const deckRaw = JSON.parse(raw) as { id: string; name: string; rarity: string; image_url?: string | null; metadata: { combat?: { atk: number; hp: number; cost: number } } }[]
      const playerCards: BoardCard[] = deckRaw.map((c, i) => ({
        uid: `p_${c.id}_${i}`, id: c.id, name: c.name, rarity: c.rarity,
        atk: c.metadata?.combat?.atk ?? 1, hp: c.metadata?.combat?.hp ?? 2,
        currentHp: c.metadata?.combat?.hp ?? 2, cost: c.metadata?.combat?.cost ?? 2,
        exhausted: false, image_url: c.image_url ?? null,
      }))

      const cardDefs = await fetch('/api/cards').then(r => r.ok ? r.json() : []).catch(() => [])
      const defs = (cardDefs ?? []).map((c: { id: string; name: string; rarity: string; imageUrl?: string | null; image_url?: string | null; metadata: unknown }) => {
        const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
        return { id: c.id, name: c.name, rarity: c.rarity, image_url: c.imageUrl ?? c.image_url ?? null, metadata: meta }
      })
      const botCards = buildBotDeck(defs)

      const playerDeck = shuffle(playerCards)
      const botDeck = shuffle(botCards)

      const p1Draw = drawCards([], playerDeck, 4)
      const p2Draw = drawCards([], botDeck, 4)

      setGs({
        p1_hp: 30, p2_hp: 30,
        p1_mana: 1, p1_max_mana: 1,
        p2_mana: 1, p2_max_mana: 1,
        p1_hand: p1Draw.hand, p1_deck: p1Draw.deck,
        p2_hand: p2Draw.hand, p2_deck: p2Draw.deck,
        p1_board: [], p2_board: [],
        turn: 1, myTurn: true,
      })
      addLog('Partie commencée ! À toi de jouer.')
    }
    init()
  }, [router, addLog])

  // Bot turn trigger
  useEffect(() => {
    if (!gs || gs.myTurn || gs.winner) return
    setBotThinking(true)
    botTimer.current = setTimeout(() => {
      setGs(prev => {
        if (!prev || prev.myTurn || prev.winner) return prev
        const after = botPlayTurn(prev)
        addLog('Bot a joué son tour.')
        // Player draws + refresh mana
        const newMaxMana = Math.min(10, after.p1_max_mana + 1)
        const p1Drew = drawCards(after.p1_hand, after.p1_deck, 1)
        const refreshed = {
          ...after,
          p1_mana: newMaxMana, p1_max_mana: newMaxMana,
          p1_hand: p1Drew.hand, p1_deck: p1Drew.deck,
          p1_board: after.p1_board.map(c => ({ ...c, exhausted: false })),
          turn: after.turn + 1,
          myTurn: true,
        }
        if (after.winner) return after
        addLog(`Tour ${refreshed.turn} — À toi !`)
        return refreshed
      })
      setBotThinking(false)
    }, 1500)
    return () => { if (botTimer.current) clearTimeout(botTimer.current) }
  }, [gs?.myTurn, gs?.winner, addLog]) // eslint-disable-line react-hooks/exhaustive-deps

  function playCard(card: BoardCard) {
    if (!gs?.myTurn || !gs) return
    if (card.cost > gs.p1_mana) { addLog('Pas assez de mana'); return }
    if (gs.p1_board.length >= 6) { addLog('Plateau plein'); return }
    addLog(`Tu joues ${card.name}`)
    setGs(s => s ? {
      ...s,
      p1_hand: s.p1_hand.filter(c => c.uid !== card.uid),
      p1_board: [...s.p1_board, { ...card, exhausted: true }],
      p1_mana: s.p1_mana - card.cost,
    } : s)
    setSelectedCard(null)
  }

  function attackTarget(target: BoardCard | 'face') {
    if (!selectedCard || !gs?.myTurn || selectedCard.exhausted) return
    const attacker = selectedCard
    setGs(s => {
      if (!s) return s
      if (target === 'face') {
        const newHp = Math.max(0, s.p2_hp - attacker.atk)
        addLog(`${attacker.name} attaque le bot pour ${attacker.atk} dégâts`)
        const newBoard = s.p1_board.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
        if (newHp <= 0) return { ...s, p2_hp: 0, p1_board: newBoard, winner: 'player' }
        return { ...s, p2_hp: newHp, p1_board: newBoard }
      } else {
        const newTargetHp = target.currentHp - attacker.atk
        const newAttHp = attacker.currentHp - target.atk
        addLog(`${attacker.name} attaque ${target.name}`)
        const newP2Board = newTargetHp <= 0
          ? s.p2_board.filter(c => c.uid !== target.uid)
          : s.p2_board.map(c => c.uid === target.uid ? { ...c, currentHp: newTargetHp } : c)
        const newP1Board = newAttHp <= 0
          ? s.p1_board.filter(c => c.uid !== attacker.uid)
          : s.p1_board.map(c => c.uid === attacker.uid ? { ...c, currentHp: newAttHp, exhausted: true } : c)
        return { ...s, p1_board: newP1Board, p2_board: newP2Board }
      }
    })
    setSelectedCard(null)
  }

  function endTurn() {
    if (!gs?.myTurn) return
    addLog('Tu passes ton tour — Bot joue…')
    setGs(s => s ? { ...s, myTurn: false } : s)
    setSelectedCard(null)
  }

  function surrender() {
    if (!confirm('Abandonner l\'entraînement ?')) return
    router.push('/combat/draft')
  }

  if (!gs) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gs.winner) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <Bot size={48} className={gs.winner === 'player' ? 'text-[#00c896]' : 'text-red-400'} />
      <div className={cn('text-4xl font-black text-center', gs.winner === 'player' ? 'text-[#00c896]' : 'text-red-400')}>
        {gs.winner === 'player' ? 'Victoire !' : 'Défaite'}
      </div>
      <p className="text-white/40 text-sm text-center">Mode entraînement — aucun point classé</p>
      <div className="flex gap-3">
        <button onClick={() => router.push('/combat/draft')}
          className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold hover:bg-white/10 transition-colors">
          Retour au draft
        </button>
        <button onClick={() => { window.location.reload() }}
          className="px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
          Rejouer
        </button>
      </div>
    </div>
  )

  const canAttackFace = gs.p2_board.length === 0

  return (
    <div className="flex flex-col gap-3 pb-4 select-none">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#030308]/90 backdrop-blur-md py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[#a78bfa]" />
          <span className="text-[#a78bfa] text-xs font-bold">Mode Entraînement</span>
          <span className="text-white/20 text-xs">Tour {gs.turn}</span>
        </div>
        <button onClick={surrender}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-900/20 text-red-400 text-xs font-bold hover:bg-red-900/40 transition-colors">
          <Flag size={12} /> Abandonner
        </button>
      </div>

      {/* ── Bot ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-white/40" />
            <span className="text-white/50 text-xs font-bold">Bot</span>
            {botThinking && <span className="text-[#a78bfa] text-[10px] animate-pulse">réfléchit…</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#ff6b6b] text-xs font-bold">
              <Heart size={12} /> {gs.p2_hp}
            </span>
            <span className="text-white/30 text-xs">{gs.p2_hand.length} en main · {gs.p2_deck.length} en deck</span>
          </div>
        </div>
        {/* Board bot */}
        <div
          className={cn('flex gap-2 flex-wrap min-h-[80px] items-center rounded-xl transition-colors p-2',
            selectedCard && canAttackFace && gs.myTurn ? 'bg-[#ff6b6b]/5 border border-[#ff6b6b]/20 cursor-pointer' : '')}
          onClick={() => selectedCard && canAttackFace && !selectedCard.exhausted && attackTarget('face')}>
          {gs.p2_board.length === 0 ? (
            <span className="text-white/20 text-xs w-full text-center">
              {selectedCard && canAttackFace ? '⚔ Cliquer pour attaquer le bot directement' : 'Plateau vide'}
            </span>
          ) : gs.p2_board.map(card => (
            <button key={card.uid}
              onClick={e => { e.stopPropagation(); selectedCard && !selectedCard.exhausted && attackTarget(card) }}
              className={cn(
                'relative w-14 rounded-xl overflow-hidden border transition-all',
                selectedCard && !selectedCard.exhausted ? 'border-[#ff6b6b]/60 hover:border-[#ff6b6b] hover:scale-105' : 'border-white/10'
              )}>
              <div className="aspect-[0.714] relative bg-[#1a0a2e]">
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

      {/* ── Attaque face directe (si board bot vide) ── */}
      {selectedCard && !selectedCard.exhausted && canAttackFace && gs.p2_board.length === 0 && (
        <button onClick={() => attackTarget('face')}
          className="w-full py-2 rounded-xl bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 text-[#ff6b6b] text-xs font-bold hover:bg-[#ff6b6b]/20 transition-colors">
          ⚔ Attaquer le bot ({selectedCard.atk} dégâts)
        </button>
      )}

      {/* ── Mon board ── */}
      <div className="rounded-2xl bg-[#7b2bff]/[0.04] border border-[#7b2bff]/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#a78bfa] text-xs font-bold">Mon plateau</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#ff6b6b] text-xs font-bold">
              <Heart size={12} /> {gs.p1_hp}
            </span>
            <span className="flex items-center gap-1 text-[#4aa3ff] text-xs font-bold">
              <Zap size={12} /> {gs.p1_mana}/{gs.p1_max_mana}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
          {gs.p1_board.length === 0 ? (
            <span className="text-white/20 text-xs w-full text-center">Pose une carte depuis ta main</span>
          ) : gs.p1_board.map(card => (
            <button key={card.uid}
              onClick={() => gs.myTurn && !card.exhausted && setSelectedCard(s => s?.uid === card.uid ? null : card)}
              className={cn(
                'relative w-14 rounded-xl overflow-hidden border-2 transition-all',
                selectedCard?.uid === card.uid ? 'border-[#7b2bff] scale-105' : 'border-transparent',
                card.exhausted ? 'opacity-40' : gs.myTurn ? 'hover:border-white/30' : ''
              )}>
              <div className="aspect-[0.714] relative bg-[#1a0a3a]">
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
          <span className="text-white/50 text-xs font-bold">Ma main ({gs.p1_hand.length}) · Deck {gs.p1_deck.length}</span>
          <button onClick={endTurn} disabled={!gs.myTurn || botThinking}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              gs.myTurn && !botThinking ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0]' : 'bg-white/5 text-white/20 cursor-not-allowed')}>
            {gs.myTurn ? 'Fin de tour' : 'Bot joue…'}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {gs.p1_hand.length === 0 ? (
            <span className="text-white/20 text-xs">Main vide</span>
          ) : gs.p1_hand.map(card => (
            <button key={card.uid}
              onClick={() => gs.myTurn && playCard(card)}
              disabled={!gs.myTurn || card.cost > gs.p1_mana || gs.p1_board.length >= 6}
              className={cn(
                'relative flex-shrink-0 w-16 rounded-xl overflow-hidden border-2 transition-all',
                !gs.myTurn || card.cost > gs.p1_mana ? 'opacity-40 cursor-not-allowed border-transparent' : 'border-transparent hover:border-[#7b2bff] hover:scale-105'
              )}>
              <div className="aspect-[0.714] relative bg-[#1a0a2e]">
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

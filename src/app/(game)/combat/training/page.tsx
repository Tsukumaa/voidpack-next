'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { CombatArena, type ArenaCard } from '@/components/game/CombatArena'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawCards(hand: ArenaCard[], deck: ArenaCard[], n: number) {
  return { hand: [...hand, ...deck.slice(0, n)], deck: deck.slice(n) }
}

interface GameState {
  p1_hp: number; p2_hp: number
  p1_mana: number; p1_max_mana: number
  p2_mana: number; p2_max_mana: number
  p1_board: ArenaCard[]; p2_board: ArenaCard[]
  p1_hand: ArenaCard[]; p2_hand: ArenaCard[]
  p1_deck: ArenaCard[]; p2_deck: ArenaCard[]
  turn: number
  myTurn: boolean
  winner?: 'player' | 'bot'
}

function buildBotDeck(cards: { id: string; name: string; rarity: string; image_url: string | null; metadata: Record<string, unknown> }[]): ArenaCard[] {
  const COPIES: Record<string, number> = { void: 1, legendary: 1, epic: 2, rare: 3, common: 4 }
  const pool: ArenaCard[] = []
  for (const c of shuffle(cards).slice(0, 20)) {
    const combat = (c.metadata?.combat ?? { atk: 1, hp: 2, cost: 2 }) as { atk: number; hp: number; cost: number }
    for (let i = 0; i < (COPIES[c.rarity] ?? 1); i++) {
      pool.push({ uid: `bot_${c.id}_${i}`, id: c.id, name: c.name, rarity: c.rarity, atk: combat.atk ?? 1, hp: combat.hp ?? 2, currentHp: combat.hp ?? 2, cost: combat.cost ?? 2, exhausted: false, image_url: c.image_url })
    }
  }
  return shuffle(pool).slice(0, 24)
}

function botPlayTurn(state: GameState): GameState {
  let s = { ...state }
  if (s.p2_deck.length > 0) { const r = drawCards(s.p2_hand, s.p2_deck, 1); s = { ...s, p2_hand: r.hand, p2_deck: r.deck } }
  const newMax = Math.min(10, s.p2_max_mana + 1)
  s = { ...s, p2_mana: newMax, p2_max_mana: newMax }
  for (const card of [...s.p2_hand].sort((a, b) => b.cost - a.cost)) {
    if (card.cost <= s.p2_mana && s.p2_board.length < 6) {
      s = { ...s, p2_hand: s.p2_hand.filter(c => c.uid !== card.uid), p2_board: [...s.p2_board, { ...card, exhausted: false }], p2_mana: s.p2_mana - card.cost }
    }
  }
  for (const att of s.p2_board.filter(c => !c.exhausted)) {
    if (s.p1_board.length > 0) {
      const tgt = [...s.p1_board].sort((a, b) => a.currentHp - b.currentHp)[0]
      const tHp = tgt.currentHp - att.atk; const aHp = att.currentHp - tgt.atk
      s = {
        ...s,
        p1_board: tHp <= 0 ? s.p1_board.filter(c => c.uid !== tgt.uid) : s.p1_board.map(c => c.uid === tgt.uid ? { ...c, currentHp: tHp } : c),
        p2_board: aHp <= 0 ? s.p2_board.filter(c => c.uid !== att.uid) : s.p2_board.map(c => c.uid === att.uid ? { ...c, currentHp: aHp, exhausted: true } : c),
      }
    } else {
      const newHp = Math.max(0, s.p1_hp - att.atk)
      s = { ...s, p1_hp: newHp, p2_board: s.p2_board.map(c => c.uid === att.uid ? { ...c, exhausted: true } : c) }
      if (newHp <= 0) return { ...s, winner: 'bot' }
    }
  }
  return s
}

export default function TrainingPage() { return <Suspense><TrainingContent /></Suspense> }

function TrainingContent() {
  const router = useRouter()
  const { user, profile } = useGameStore(s => ({ user: s.user, profile: s.profile }))
  const [gs, setGs] = useState<GameState | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [botThinking, setBotThinking] = useState(false)
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLog = useCallback((msg: string) => setLog(l => [msg, ...l].slice(0, 30)), [])

  useEffect(() => {
    async function init() {
      const raw = sessionStorage.getItem('draft_deck')
      if (!raw) { router.push('/combat/draft'); return }
      const deckRaw = JSON.parse(raw) as { id: string; name: string; rarity: string; image_url?: string | null; metadata: { combat?: { atk: number; hp: number; cost: number } } }[]
      const playerCards: ArenaCard[] = deckRaw.map((c, i) => ({
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
      const botDeck = buildBotDeck(defs)
      const p1 = drawCards([], shuffle(playerCards), 4)
      const p2 = drawCards([], shuffle(botDeck), 4)
      setGs({ p1_hp: 30, p2_hp: 30, p1_mana: 1, p1_max_mana: 1, p2_mana: 1, p2_max_mana: 1, p1_hand: p1.hand, p1_deck: p1.deck, p2_hand: p2.hand, p2_deck: p2.deck, p1_board: [], p2_board: [], turn: 1, myTurn: true })
      addLog('Partie commencée ! À toi de jouer.')
    }
    init()
  }, [router, addLog])

  // Bot turn
  useEffect(() => {
    if (!gs || gs.myTurn || gs.winner) return
    setBotThinking(true)
    botTimer.current = setTimeout(() => {
      setGs(prev => {
        if (!prev || prev.myTurn || prev.winner) return prev
        const after = botPlayTurn(prev)
        if (after.winner) { setBotThinking(false); return after }
        addLog('Bot a joué son tour.')
        const newMax = Math.min(10, after.p1_max_mana + 1)
        const drew = drawCards(after.p1_hand, after.p1_deck, 1)
        const next = { ...after, p1_mana: newMax, p1_max_mana: newMax, p1_hand: drew.hand, p1_deck: drew.deck, p1_board: after.p1_board.map(c => ({ ...c, exhausted: false })), turn: after.turn + 1, myTurn: true }
        addLog(`Tour ${next.turn} — À toi !`)
        setBotThinking(false)
        return next
      })
    }, 1500)
    return () => { if (botTimer.current) clearTimeout(botTimer.current) }
  }, [gs?.myTurn, gs?.winner, addLog]) // eslint-disable-line react-hooks/exhaustive-deps

  function playCard(card: ArenaCard) {
    if (!gs?.myTurn) return
    if (card.cost > gs.p1_mana) { addLog('Pas assez de mana'); return }
    if (gs.p1_board.length >= 6) { addLog('Plateau plein (max 6)'); return }
    addLog(`Tu joues ${card.name}`)
    setGs(s => s ? { ...s, p1_hand: s.p1_hand.filter(c => c.uid !== card.uid), p1_board: [...s.p1_board, { ...card, exhausted: true }], p1_mana: s.p1_mana - card.cost } : s)
  }

  function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    if (!gs?.myTurn || attacker.exhausted) return
    setGs(s => {
      if (!s) return s
      if (target === 'face') {
        const newHp = Math.max(0, s.p2_hp - attacker.atk)
        addLog(`${attacker.name} attaque le bot pour ${attacker.atk}`)
        const newBoard = s.p1_board.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
        if (newHp <= 0) return { ...s, p2_hp: 0, p1_board: newBoard, winner: 'player' as const }
        return { ...s, p2_hp: newHp, p1_board: newBoard }
      }
      const tHp = target.currentHp - attacker.atk; const aHp = attacker.currentHp - target.atk
      addLog(`${attacker.name} attaque ${target.name}`)
      return {
        ...s,
        p2_board: tHp <= 0 ? s.p2_board.filter(c => c.uid !== target.uid) : s.p2_board.map(c => c.uid === target.uid ? { ...c, currentHp: tHp } : c),
        p1_board: aHp <= 0 ? s.p1_board.filter(c => c.uid !== attacker.uid) : s.p1_board.map(c => c.uid === attacker.uid ? { ...c, currentHp: aHp, exhausted: true } : c),
      }
    })
  }

  function endTurn() {
    if (!gs?.myTurn) return
    addLog('Tu passes — Bot joue…')
    setGs(s => s ? { ...s, myTurn: false } : s)
  }

  function surrender() {
    if (!confirm('Abandonner ?')) return
    router.push('/combat/draft')
  }

  if (!gs) return (
    <div className="flex items-center justify-center min-h-screen bg-[#030308]">
      <div className="w-10 h-10 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gs.winner) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030308] gap-6 px-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #1a0a3a44, #030308)' }}>
      <Bot size={52} className={gs.winner === 'player' ? 'text-[#00c896]' : 'text-[#ff4757]'} />
      <div className={`text-5xl font-black ${gs.winner === 'player' ? 'text-[#00c896]' : 'text-[#ff4757]'}`}>
        {gs.winner === 'player' ? 'Victoire !' : 'Défaite'}
      </div>
      <p className="text-white/30 text-sm">Entraînement · aucun point classé</p>
      <div className="flex gap-3">
        <button onClick={() => router.push('/combat/draft')}
          className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold hover:bg-white/10 transition-colors">
          Retour au draft
        </button>
        <button onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-2xl bg-[#7b2bff] text-white font-bold hover:bg-[#6920e0] transition-colors">
          Rejouer
        </button>
      </div>
    </div>
  )

  return (
    <CombatArena
      myHp={gs.p1_hp} oppHp={gs.p2_hp}
      myMana={gs.p1_mana} myMaxMana={gs.p1_max_mana}
      myBoard={gs.p1_board} oppBoard={gs.p2_board}
      myHand={gs.p1_hand}
      myDeckCount={gs.p1_deck.length}
      oppHandCount={gs.p2_hand.length}
      oppDeckCount={gs.p2_deck.length}
      myName={profile?.username ?? 'Moi'}
      oppName="Bot"
      myAvatar={profile?.avatar_url ?? null}
      myTurn={gs.myTurn}
      disabled={botThinking}
      topLabel={
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 text-[#a78bfa] text-xs font-bold">
          <Bot size={12} /> Entraînement
          {botThinking && <span className="animate-pulse">· bot réfléchit…</span>}
        </div>
      }
      onPlayCard={playCard}
      onAttack={handleAttack}
      onEndTurn={endTurn}
      onSurrender={surrender}
      log={log}
    />
  )
}

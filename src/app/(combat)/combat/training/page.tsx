'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { CombatArena, type ArenaCard } from '@/components/game/CombatArena'

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function uid(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2)}` }

// ── Card builder ───────────────────────────────────────────────────────────
function makeArenaCard(c: { id: string; name: string; rarity: string; image_url?: string | null; metadata: { combat?: { atk: number; hp: number; cost: number } } }, prefix: string, i: number): ArenaCard {
  const combat = c.metadata?.combat ?? { atk: 1, hp: 2, cost: 2 }
  return {
    uid: uid(`${prefix}_${c.id}_${i}`),
    id: c.id, name: c.name, rarity: c.rarity,
    atk: combat.atk ?? 1, hp: combat.hp ?? 2,
    currentHp: combat.hp ?? 2, cost: combat.cost ?? 2,
    exhausted: false, image_url: c.image_url ?? null,
  }
}

function buildBotDeck(defs: { id: string; name: string; rarity: string; image_url?: string | null; metadata: Record<string, unknown> }[]): ArenaCard[] {
  const COPIES: Record<string, number> = { void: 1, legendary: 1, epic: 2, rare: 3, common: 4 }
  const pool: ArenaCard[] = []
  for (const c of shuffle(defs).slice(0, 20)) {
    const meta = c.metadata as { combat?: { atk: number; hp: number; cost: number } }
    const n = COPIES[c.rarity] ?? 1
    for (let i = 0; i < n; i++) {
      pool.push(makeArenaCard({ ...c, metadata: meta }, 'bot', i))
    }
  }
  return shuffle(pool).slice(0, 24)
}

// ── Game state ─────────────────────────────────────────────────────────────
interface GS {
  turn: number
  phase: 'player' | 'enemy'
  playerHp: number; enemyHp: number
  playerMana: number; playerMaxMana: number
  enemyMana:  number; enemyMaxMana:  number
  playerHand: ArenaCard[]; playerDeck: ArenaCard[]
  enemyHand:  ArenaCard[]; enemyDeck:  ArenaCard[]
  playerBoard: ArenaCard[]; enemyBoard: ArenaCard[]
  selected: ArenaCard | null
  locked: boolean
  gameOver: boolean
  winner: 'player' | 'enemy' | null
  log: string
}

const MAX_BOARD = 5
const MAX_HAND  = 7

export default function TrainingPage() { return <Suspense><TrainingContent /></Suspense> }

function TrainingContent() {
  const router = useRouter()
  const { profile } = useGameStore(s => ({ profile: s.profile }))
  const [gs, setGs] = useState<GS | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const gsRef = useRef<GS | null>(null)

  // Keep ref in sync so bot sequence can read latest state without stale closure
  useEffect(() => { gsRef.current = gs }, [gs])

  const update = useCallback((fn: (prev: GS) => GS) => {
    setGs(prev => {
      if (!prev) return prev
      const next = fn(prev)
      gsRef.current = next
      return next
    })
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const raw = sessionStorage.getItem('draft_deck')
      if (!raw) { router.push('/combat/draft'); return }

      const deckRaw = JSON.parse(raw) as { id: string; name: string; rarity: string; image_url?: string | null; metadata: { combat?: { atk: number; hp: number; cost: number } } }[]
      const playerCards: ArenaCard[] = shuffle(
        deckRaw.map((c, i) => makeArenaCard(c, 'p', i))
      )

      const cardDefs = await fetch('/api/cards').then(r => r.ok ? r.json() : []).catch(() => []) as { id: string; name: string; rarity: string; imageUrl?: string | null; image_url?: string | null; metadata: unknown }[]
      const defs = (cardDefs ?? []).map(c => {
        const meta = typeof c.metadata === 'string'
          ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })()
          : (c.metadata ?? {})
        return { id: c.id, name: c.name, rarity: c.rarity, image_url: c.imageUrl ?? c.image_url ?? null, metadata: meta as Record<string, unknown> }
      })
      const botCards = buildBotDeck(defs)

      const pDeck = [...playerCards]; const pHand = pDeck.splice(0, 4)
      const bDeck = [...botCards];   const bHand = bDeck.splice(0, 4)

      const initial: GS = {
        turn: 1, phase: 'player',
        playerHp: 30, enemyHp: 30,
        playerMana: 1, playerMaxMana: 1,
        enemyMana: 1, enemyMaxMana: 1,
        playerHand: pHand, playerDeck: pDeck,
        enemyHand: bHand, enemyDeck: bDeck,
        playerBoard: [], enemyBoard: [],
        selected: null, locked: false, gameOver: false, winner: null,
        log: 'Ton tour !',
      }
      setGs(initial)
      gsRef.current = initial
    }
    init()
  }, [router])

  // ── Play card (player) ──────────────────────────────────────────────────
  function playCard(card: ArenaCard) {
    update(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver) return g
      if (card.cost > g.playerMana) return { ...g, log: 'Pas assez de mana !' }
      if (g.playerBoard.length >= MAX_BOARD) return { ...g, log: 'Plateau plein !' }
      return {
        ...g,
        playerMana: g.playerMana - card.cost,
        playerHand: g.playerHand.filter(c => c.uid !== card.uid),
        playerBoard: [...g.playerBoard, { ...card, exhausted: true }],
        selected: null,
        log: `${card.name} invoqué !`,
      }
    })
  }

  // ── Attack (player) ─────────────────────────────────────────────────────
  function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    update(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver || attacker.exhausted) return g

      if (target === 'face') {
        const newEnemyHp = Math.max(0, g.enemyHp - attacker.atk)
        const newPlayerBoard = g.playerBoard.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
        const gameOver = newEnemyHp <= 0
        return {
          ...g,
          enemyHp: newEnemyHp,
          playerBoard: newPlayerBoard,
          selected: null,
          gameOver,
          winner: gameOver ? 'player' : null,
          log: gameOver ? '🏆 Victoire !' : `${attacker.name} attaque le héros ennemi pour ${attacker.atk} !`,
        }
      }

      const tHp = target.currentHp - attacker.atk
      const aHp = attacker.currentHp - target.atk
      const newEnemyBoard = tHp <= 0
        ? g.enemyBoard.filter(c => c.uid !== target.uid)
        : g.enemyBoard.map(c => c.uid === target.uid ? { ...c, currentHp: tHp } : c)
      const newPlayerBoard = aHp <= 0
        ? g.playerBoard.filter(c => c.uid !== attacker.uid)
        : g.playerBoard.map(c => c.uid === attacker.uid ? { ...c, currentHp: aHp, exhausted: true } : c)
      return {
        ...g,
        enemyBoard: newEnemyBoard,
        playerBoard: newPlayerBoard,
        selected: null,
        log: `${attacker.name} attaque ${target.name} !`,
      }
    })
  }

  // ── End player turn → trigger bot ───────────────────────────────────────
  function endTurn() {
    update(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver) return g
      return { ...g, phase: 'enemy', selected: null, locked: true, log: 'Tour du bot…' }
    })
  }

  // ── Bot turn sequence ────────────────────────────────────────────────────
  useEffect(() => {
    if (!gs || gs.phase !== 'enemy' || gs.gameOver) return
    setBotThinking(true)

    let cancelled = false

    function read() { return gsRef.current! }

    function set(fn: (g: GS) => GS) {
      setGs(prev => {
        if (!prev || cancelled) return prev
        const next = fn(prev)
        gsRef.current = next
        return next
      })
    }

    function checkWin(g: GS): GS {
      if (g.enemyHp <= 0)  return { ...g, gameOver: true, winner: 'player', log: '🏆 Victoire !' }
      if (g.playerHp <= 0) return { ...g, gameOver: true, winner: 'enemy',  log: '💀 Défaite.' }
      return g
    }

    // Step 1: increment turn + draw + play one card
    setTimeout(() => {
      if (cancelled) return
      set(g => {
        let next = { ...g }
        next.turn++
        next.enemyMaxMana = Math.min(10, next.turn)
        next.enemyMana    = next.enemyMaxMana
        // Bot draws
        if (next.enemyDeck.length && next.enemyHand.length < MAX_HAND) {
          next = { ...next, enemyHand: [...next.enemyHand, next.enemyDeck[0]], enemyDeck: next.enemyDeck.slice(1) }
        }
        // Bot plays one card (most expensive affordable)
        const affordable = next.enemyHand
          .filter(c => c.cost <= next.enemyMana && next.enemyBoard.length < MAX_BOARD)
          .sort((a, b) => b.cost - a.cost)
        if (affordable.length) {
          const card = affordable[0]
          next.enemyMana -= card.cost
          next = {
            ...next,
            enemyHand: next.enemyHand.filter(c => c.uid !== card.uid),
            enemyBoard: [...next.enemyBoard, { ...card, exhausted: true }],
            log: `Bot invoque ${card.name} !`,
          }
        }
        return next
      })

      // Step 2: bot attacks sequentially
      function botAttackSeq(idx: number) {
        if (cancelled) return
        const g = read()
        if (g.gameOver) { setBotThinking(false); return }

        const attackers = g.enemyBoard.filter(c => !c.exhausted)
        if (idx >= attackers.length) {
          // Return to player turn
          setTimeout(() => {
            if (cancelled) return
            set(g2 => {
              let next = { ...g2 }
              next.phase = 'player'
              next.playerMaxMana = Math.min(10, next.turn)
              next.playerMana    = next.playerMaxMana
              // Player draws
              if (next.playerDeck.length && next.playerHand.length < MAX_HAND) {
                next = { ...next, playerHand: [...next.playerHand, next.playerDeck[0]], playerDeck: next.playerDeck.slice(1) }
              }
              // Un-exhaust player board
              next.playerBoard = next.playerBoard.map(c => ({ ...c, exhausted: false }))
              next.locked = false
              next.log    = `Tour ${next.turn} — Mana : ${next.playerMana}`
              return next
            })
            setBotThinking(false)
          }, 400)
          return
        }

        const card = attackers[idx]
        setTimeout(() => {
          if (cancelled) return
          set(g2 => {
            let next = { ...g2 }
            // Check card still alive
            if (!next.enemyBoard.find(c => c.uid === card.uid)) {
              return next // card died in previous attack, skip
            }
            if (next.playerBoard.length > 0) {
              const tgt = [...next.playerBoard].sort((a, b) => a.currentHp - b.currentHp)[0]
              const tHp = tgt.currentHp - card.atk
              const aHp = card.currentHp - tgt.atk
              next.enemyBoard = aHp <= 0
                ? next.enemyBoard.filter(c => c.uid !== card.uid)
                : next.enemyBoard.map(c => c.uid === card.uid ? { ...c, currentHp: aHp, exhausted: true } : c)
              next.playerBoard = tHp <= 0
                ? next.playerBoard.filter(c => c.uid !== tgt.uid)
                : next.playerBoard.map(c => c.uid === tgt.uid ? { ...c, currentHp: tHp } : c)
              next.log = `Bot : ${card.name} attaque ${tgt.name} !`
            } else {
              // attack face
              next.playerHp  = Math.max(0, next.playerHp - card.atk)
              next.enemyBoard = next.enemyBoard.map(c => c.uid === card.uid ? { ...c, exhausted: true } : c)
              next.log = `Bot : ${card.name} attaque ton héros pour ${card.atk} !`
            }
            return checkWin(next)
          })
          botAttackSeq(idx + 1)
        }, 450)
      }

      setTimeout(() => botAttackSeq(0), 700)
    }, 700)

    return () => { cancelled = true }
  }, [gs?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Surrender ───────────────────────────────────────────────────────────
  function surrender() {
    if (!confirm('Abandonner ?')) return
    router.push('/combat/draft')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (!gs) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#030308' }}>
      <div className="w-10 h-10 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gs.gameOver) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4"
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
      myHp={gs.playerHp} oppHp={gs.enemyHp}
      myMana={gs.playerMana} myMaxMana={gs.playerMaxMana}
      myBoard={gs.playerBoard} oppBoard={gs.enemyBoard}
      myHand={gs.playerHand}
      myDeckCount={gs.playerDeck.length}
      oppHandCount={gs.enemyHand.length}
      myName={profile?.username ?? 'Toi'}
      oppName="Bot"
      myAvatar={profile?.avatar_url ?? null}
      myTurn={gs.phase === 'player' && !gs.locked}
      disabled={gs.locked || botThinking}
      topLabel={
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#7b2bff]/10 border border-[#7b2bff]/20 text-[#a78bfa] text-xs font-bold">
          <Bot size={12} /> Entraînement · Tour {gs.turn}
          {botThinking && <span className="animate-pulse ml-1">· bot réfléchit…</span>}
        </div>
      }
      onPlayCard={playCard}
      onAttack={handleAttack}
      onEndTurn={endTurn}
      onSurrender={surrender}
      log={[gs.log]}
    />
  )
}

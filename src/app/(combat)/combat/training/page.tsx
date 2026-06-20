'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { useArenaBg } from '@/lib/game/useArenaBg'
import { CombatArena, type ArenaCard } from '@/components/game/CombatArena'

// ── Constants (matches old site) ───────────────────────────────────────────
const DECK_SIZE      = 24
const MAX_BOARD      = 5
const MAX_HAND       = 7
const RARITY_COST: Record<string, number>  = { common: 1, rare: 2, epic: 3, legendary: 4, void: 5 }
const RARITY_ATK:  Record<string, number>  = { common: 1, rare: 2, epic: 3, legendary: 5, void: 6 }
const RARITY_HP:   Record<string, number>  = { common: 2, rare: 3, epic: 4, legendary: 4, void: 5 }

// ── Game state ─────────────────────────────────────────────────────────────
interface CardDef { id: string; name: string; rarity: string; image_url: string | null; metadata: { combat?: { atk?: number; hp?: number; cost?: number; effects?: string[] } } }

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

// ── Helpers ────────────────────────────────────────────────────────────────
let _uid = 0
function nextUid() { return ++_uid }

function getCombatStats(card: CardDef) {
  const c = card.metadata?.combat ?? {}
  const r = card.rarity ?? 'common'
  return {
    atk:     Number.isFinite(c.atk)  ? c.atk!  : (RARITY_ATK[r]  ?? 1),
    hp:      Number.isFinite(c.hp)   ? c.hp!   : (RARITY_HP[r]   ?? 2),
    cost:    RARITY_COST[r] ?? 1,
    effects: c.effects ?? [],
  }
}

function expandDeck(entries: (CardDef & { qty?: number })[]): ArenaCard[] {
  const cards: ArenaCard[] = []
  for (const entry of entries) {
    const stats = getCombatStats(entry)
    const qty = entry.qty ?? 1
    for (let i = 0; i < qty; i++) {
      cards.push({
        uid: nextUid(),
        id: entry.id, name: entry.name, rarity: entry.rarity,
        atk: stats.atk, hp: stats.hp, currentHp: stats.hp, cost: stats.cost,
        exhausted: false, image_url: entry.image_url ?? null,
      })
    }
  }
  return cards.sort(() => Math.random() - 0.5)
}

function buildBotDeck(defs: CardDef[]): ArenaCard[] {
  const shuffled = [...defs].sort(() => Math.random() - 0.5)
  const deckEntries: (CardDef & { qty: number })[] = []
  let budget = 0, size = 0
  for (const card of shuffled) {
    if (size >= DECK_SIZE || budget >= 60) break
    const cost = RARITY_COST[card.rarity] ?? 1
    const maxCopies = ['legendary', 'void'].includes(card.rarity) ? 1 : 3
    const canAdd = Math.min(maxCopies, Math.floor((60 - budget) / cost), DECK_SIZE - size)
    if (canAdd <= 0) continue
    const qty = Math.max(1, Math.min(canAdd, 1 + Math.floor(Math.random() * maxCopies)))
    deckEntries.push({ ...card, qty })
    budget += cost * qty
    size += qty
  }
  return expandDeck(deckEntries)
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function TrainingPage() { return <Suspense><TrainingContent /></Suspense> }

function TrainingContent() {
  const router  = useRouter()
  const profile = useGameStore(s => s.profile)
  const arenaBg = useArenaBg()
  const [gs, setGs] = useState<GS | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const gsRef = useRef<GS | null>(null)

  function read() { return gsRef.current! }
  function set(fn: (g: GS) => GS) {
    setGs(prev => {
      if (!prev) return prev
      const next = fn(prev)
      gsRef.current = next
      return next
    })
  }

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    _uid = 0
    async function init() {
      const raw = sessionStorage.getItem('draft_deck')
      if (!raw) { router.push('/combat/draft'); return }

      const deckRaw = JSON.parse(raw) as (CardDef & { qty?: number })[]
      const playerCards = expandDeck(deckRaw)

      const apiCards = await fetch('/api/cards').then(r => r.ok ? r.json() : []).catch(() => []) as { id: string; name: string; rarity: string; imageUrl?: string | null; image_url?: string | null; metadata: unknown }[]
      const defs: CardDef[] = (apiCards ?? []).map(c => {
        const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
        return { id: c.id, name: c.name, rarity: c.rarity, image_url: c.imageUrl ?? c.image_url ?? null, metadata: meta as CardDef['metadata'] }
      })
      const botCards = buildBotDeck(defs)

      const pDeck = [...playerCards]; const pHand = pDeck.splice(0, 4)
      const bDeck = [...botCards];   const bHand = bDeck.splice(0, 4)

      const g: GS = {
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
      gsRef.current = g
      setGs(g)
    }
    init()
  }, [router])

  // ── Check win ──────────────────────────────────────────────────────────
  function checkWin(g: GS): GS {
    if (g.enemyHp  <= 0) return { ...g, gameOver: true, winner: 'player', log: '🏆 Victoire ! Tu as vaincu le bot.' }
    if (g.playerHp <= 0) return { ...g, gameOver: true, winner: 'enemy',  log: '💀 Défaite. Le bot a gagné.' }
    return g
  }

  // ── Play card ──────────────────────────────────────────────────────────
  function playCard(card: ArenaCard) {
    set(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver) return g
      if (card.cost > g.playerMana) return { ...g, log: 'Pas assez de mana !' }
      if (g.playerBoard.length >= MAX_BOARD)  return { ...g, log: 'Plateau plein !' }
      return {
        ...g,
        playerMana:  g.playerMana - card.cost,
        playerHand:  g.playerHand.filter(c => c.uid !== card.uid),
        playerBoard: [...g.playerBoard, { ...card, exhausted: true }],
        selected: null,
        log: `${card.name} invoqué !`,
      }
    })
  }

  // ── Player attack ──────────────────────────────────────────────────────
  function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    set(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver || attacker.exhausted) return g
      if (target === 'face') {
        const newEnemyHp = Math.max(0, g.enemyHp - attacker.atk)
        const newBoard = g.playerBoard.map(c => c.uid === attacker.uid ? { ...c, exhausted: true } : c)
        return checkWin({
          ...g,
          enemyHp: newEnemyHp,
          playerBoard: newBoard,
          selected: null,
          log: `${attacker.name} attaque le héros ennemi pour ${attacker.atk} !`,
        })
      }
      const t = target as ArenaCard
      const tHp = t.currentHp - attacker.atk
      const aHp = attacker.currentHp - t.atk
      return {
        ...g,
        enemyBoard:  tHp <= 0 ? g.enemyBoard.filter(c => c.uid !== t.uid)  : g.enemyBoard.map(c => c.uid === t.uid  ? { ...c, currentHp: tHp } : c),
        playerBoard: aHp <= 0 ? g.playerBoard.filter(c => c.uid !== attacker.uid) : g.playerBoard.map(c => c.uid === attacker.uid ? { ...c, currentHp: aHp, exhausted: true } : c),
        selected: null,
        log: `${attacker.name} attaque ${t.name} !`,
      }
    })
  }

  // ── End turn → trigger bot ─────────────────────────────────────────────
  function endTurn() {
    set(g => {
      if (g.phase !== 'player' || g.locked || g.gameOver) return g
      return { ...g, phase: 'enemy', selected: null, locked: true, log: 'Tour du bot…' }
    })
  }

  // ── Bot sequence (mirrors old site's botTurn + botAttackSeq) ──────────
  useEffect(() => {
    if (!gs || gs.phase !== 'enemy' || gs.gameOver) return
    setBotThinking(true)
    let cancelled = false

    // Step 1: increment turn, draw, play one card
    const t1 = setTimeout(() => {
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
        // Play most expensive affordable card
        const playable = next.enemyHand
          .filter(c => c.cost <= next.enemyMana && next.enemyBoard.length < MAX_BOARD)
          .sort((a, b) => b.cost - a.cost)
        if (playable.length) {
          const card = playable[0]
          next = {
            ...next,
            enemyMana:  next.enemyMana - card.cost,
            enemyHand:  next.enemyHand.filter(c => c.uid !== card.uid),
            enemyBoard: [...next.enemyBoard, { ...card, exhausted: true }],
            log: `Bot invoque ${card.name} !`,
          }
        }
        return next
      })

      // Step 2: attack sequence
      function botAttackSeq(i: number) {
        if (cancelled) return
        const g = read()
        if (g.gameOver) { setBotThinking(false); return }

        const attackers = g.enemyBoard.filter(c => !c.exhausted)
        if (i >= attackers.length) {
          // Return to player
          const t2 = setTimeout(() => {
            if (cancelled) return
            set(g2 => {
              let next = { ...g2 }
              next.phase = 'player'
              next.playerMaxMana = Math.min(10, next.turn)
              next.playerMana    = next.playerMaxMana
              if (next.playerDeck.length && next.playerHand.length < MAX_HAND) {
                next = { ...next, playerHand: [...next.playerHand, next.playerDeck[0]], playerDeck: next.playerDeck.slice(1) }
              }
              next.playerBoard = next.playerBoard.map(c => ({ ...c, exhausted: false }))
              next.locked = false
              next.log    = `Tour ${next.turn} — Mana : ${next.playerMana}`
              return next
            })
            setBotThinking(false)
          }, 400)
          return () => clearTimeout(t2)
        }

        const card = attackers[i]
        const t3 = setTimeout(() => {
          if (cancelled) return
          set(g2 => {
            // Card might have died from previous combat
            if (!g2.enemyBoard.find(c => c.uid === card.uid)) return g2

            let next = { ...g2 }
            if (next.playerBoard.length > 0) {
              const tgt = [...next.playerBoard].sort((a, b) => a.currentHp - b.currentHp)[0]
              const tHp = tgt.currentHp - card.atk
              const aHp = card.currentHp - tgt.atk
              next.playerBoard = tHp <= 0
                ? next.playerBoard.filter(c => c.uid !== tgt.uid)
                : next.playerBoard.map(c => c.uid === tgt.uid ? { ...c, currentHp: tHp } : c)
              next.enemyBoard = aHp <= 0
                ? next.enemyBoard.filter(c => c.uid !== card.uid)
                : next.enemyBoard.map(c => c.uid === card.uid ? { ...c, currentHp: aHp, exhausted: true } : c)
              next.log = `Bot : ${card.name} attaque ${tgt.name} !`
            } else {
              next.playerHp  = Math.max(0, next.playerHp - card.atk)
              next.enemyBoard = next.enemyBoard.map(c => c.uid === card.uid ? { ...c, exhausted: true } : c)
              next.log = `Bot : ${card.name} attaque ton héros pour ${card.atk} !`
            }
            return checkWin(next)
          })
          botAttackSeq(i + 1)
        }, 450)
        return () => clearTimeout(t3)
      }

      const t4 = setTimeout(() => { if (!cancelled) botAttackSeq(0) }, 700)
      return () => clearTimeout(t4)
    }, 700)

    return () => { cancelled = true; clearTimeout(t1) }
  }, [gs?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Surrender ──────────────────────────────────────────────────────────
  function surrender() {
    if (!confirm('Abandonner la partie ?')) return
    router.push('/combat/draft')
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (!gs) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#050210' }}>
      <div className="w-10 h-10 border-2 border-[#7b2bff]/30 border-t-[#7b2bff] rounded-full animate-spin" />
    </div>
  )

  if (gs.gameOver) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24, padding: '0 16px', background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #1a0a3a44, #050210)' }}>
      <Bot size={52} style={{ color: gs.winner === 'player' ? '#00c896' : '#ff4757' }} />
      <div style={{ fontSize: 48, fontWeight: 900, color: gs.winner === 'player' ? '#00c896' : '#ff4757' }}>
        {gs.winner === 'player' ? 'Victoire !' : 'Défaite'}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Entraînement · aucun point classé</p>
      <div style={{ display: 'flex', gap: 12 }}>
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
      myHp={gs.playerHp}    oppHp={gs.enemyHp}
      myMana={gs.playerMana} myMaxMana={gs.playerMaxMana}
      myBoard={gs.playerBoard} oppBoard={gs.enemyBoard}
      myHand={gs.playerHand}
      myTurn={gs.phase === 'player'}
      locked={gs.locked || botThinking}
      myName={profile?.username ?? 'Toi'}
      oppName="Bot"
      myAvatar={profile?.avatar_url ?? null}
      arenaBg={arenaBg}
      turnLabel={`Tour ${gs.turn}`}
      topLabel={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bot size={12} /> Entraînement
          {botThinking && <span style={{ animation: 'ca-hint-pulse 1.5s ease-in-out infinite' }}>· bot réfléchit…</span>}
        </span>
      }
      onPlayCard={playCard}
      onAttack={handleAttack}
      onEndTurn={endTurn}
      onSurrender={surrender}
      log={gs.log}
    />
  )
}

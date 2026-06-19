'use client'
import './combat-arena.css'
import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'

// ── Types ──────────────────────────────────────────────────────────────────
export interface ArenaCard {
  uid: string | number
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

interface DmgPopup  { id: string; x: number; y: number; value: number }
interface ImpactPop { id: string; x: number; y: number }

export interface CombatArenaProps {
  myHp: number; oppHp: number
  myMana: number; myMaxMana: number
  myBoard: ArenaCard[]; oppBoard: ArenaCard[]
  myHand: ArenaCard[]
  myTurn: boolean; locked?: boolean
  myName?: string; oppName?: string
  turnLabel?: string
  topLabel?: React.ReactNode
  onPlayCard:  (card: ArenaCard) => void
  onAttack:    (attacker: ArenaCard, target: ArenaCard | 'face') => void
  onEndTurn:   () => void
  onSurrender: () => void
  log?: string
  // imperative animation triggers (called by parent after state updates)
  onShakeUid?: (uid: string | number) => void
  onDmgAt?:    (x: number, y: number, value: number) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}

function hpColor(pct: number) {
  return pct > 0.6 ? '#ff8080' : pct > 0.3 ? '#ff9a3d' : '#ff4757'
}
function myHpColor(pct: number) {
  return pct > 0.6 ? '#a080ff' : pct > 0.3 ? '#ff9a3d' : '#ff4757'
}

// ── Sub-components ─────────────────────────────────────────────────────────
function HpRow({ hp, maxHp = 30, label, color }: { hp: number; maxHp?: number; label: string; color: (p: number) => string }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp))
  const col = color(pct)
  return (
    <div className="ca-hp-row">
      <span className="ca-hp-label" style={{ color: col }}>{label}</span>
      <div className="ca-hp-bg">
        <div className="ca-hp-fill" style={{ width: `${pct * 100}%`, background: col }} />
      </div>
      <span className="ca-hp-text" style={{ color: col }}>{Math.max(0, hp)} / {maxHp}</span>
    </div>
  )
}

function ManaRow({ mana, max }: { mana: number; max: number }) {
  return (
    <div className="ca-mana-row">
      {Array.from({ length: Math.min(max, 10) }).map((_, i) => (
        <span key={i} className={`ca-mana-crystal${i < mana ? ' active' : ''}`} />
      ))}
      <span className="ca-mana-lbl">{mana}/{max}</span>
    </div>
  )
}

function CombatCard({
  card, isEnemy, canAttack, isSelected, isAttackable, isInHand, canPlay,
  onClick,
}: {
  card: ArenaCard
  isEnemy: boolean; canAttack?: boolean; isSelected?: boolean
  isAttackable?: boolean; isInHand?: boolean; canPlay?: boolean
  onClick: () => void
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const hpPct = card.currentHp / card.hp

  let cls = 'ca-card'
  if (isEnemy)      cls += ' enemy'
  if (card.exhausted && !isAttackable) cls += ' exhausted'
  if (canAttack)    cls += ' can-attack'
  if (isSelected)   cls += ' selected'
  if (isAttackable) cls += ' attackable'
  if (isInHand && canPlay)  cls += ' playable'

  return (
    <div className={cls} onClick={onClick}>
      {/* Rarity tint on cost gem */}
      <div className="ca-card-cost" style={{ background: color }}>{card.cost}</div>

      {/* Art */}
      {card.image_url
        ? <div className="ca-card-art" style={{ backgroundImage: `url('${card.image_url}')` }} />
        : <div className="ca-card-art-placeholder">✦</div>
      }

      {/* Nom en haut */}
      <div className="ca-card-name">{card.name}</div>

      {/* Stats visibles : ATK bas-gauche, PV bas-droite */}
      <div className="ca-card-stat ca-card-atk">{card.atk}</div>
      <div className={`ca-card-stat ca-card-hp${card.currentHp < card.hp ? ' dmg' : ''}`}>{card.currentHp}</div>

      {/* HP bar at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, zIndex: 3,
        background: 'rgba(0,0,0,.6)',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, hpPct) * 100}%`,
          background: hpPct > 0.5 ? '#50d080' : hpPct > 0.25 ? '#ff9a3d' : '#ff4757',
          transition: 'width .4s',
        }} />
      </div>

      {/* Tooltip */}
      <div className="ca-tooltip">
        <div className="ca-tooltip-name uppercase">{card.name}</div>
        <div className="ca-tooltip-stats">
          <span className="ca-tooltip-stat ca-tooltip-stat--atk">⚔ {card.atk}</span>
          <span className="ca-tooltip-stat ca-tooltip-stat--hp">♥ {card.currentHp}/{card.hp}</span>
          <span className="ca-tooltip-stat ca-tooltip-stat--cost">✦ {card.cost}</span>
        </div>
        <div className="ca-tooltip-rarity">{card.rarity}</div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export function CombatArena({
  myHp, oppHp, myMana, myMaxMana,
  myBoard, oppBoard, myHand,
  myTurn, locked = false,
  myName = 'Toi', oppName = 'Bot',
  turnLabel, topLabel,
  onPlayCard, onAttack, onEndTurn, onSurrender,
  log = '',
}: CombatArenaProps) {
  const [selected, setSelected] = useState<ArenaCard | null>(null)
  const [shakingUids, setShakingUids] = useState<Set<string | number>>(new Set())
  const [dmgPopups,  setDmgPopups]  = useState<DmgPopup[]>([])
  const [impacts,    setImpacts]    = useState<ImpactPop[]>([])
  const arenaRef = useRef<HTMLDivElement>(null)

  // Reset selection when turn changes
  useEffect(() => { setSelected(null) }, [myTurn])

  const shake = useCallback((uid: string | number) => {
    setShakingUids(s => new Set([...s, uid]))
    setTimeout(() => setShakingUids(s => { const n = new Set(s); n.delete(uid); return n }), 350)
  }, [])

  const spawnDmg = useCallback((el: HTMLElement | null, value: number) => {
    if (!el || !arenaRef.current) return
    const ar = arenaRef.current.getBoundingClientRect()
    const tr = el.getBoundingClientRect()
    const x = tr.left - ar.left + tr.width / 2
    const y = tr.top  - ar.top  - 8
    const id = `dmg_${Date.now()}_${Math.random()}`
    setDmgPopups(p => [...p, { id, x, y, value }])
    setTimeout(() => setDmgPopups(p => p.filter(d => d.id !== id)), 1000)
  }, [])

  const spawnImpact = useCallback((el: HTMLElement | null) => {
    if (!el || !arenaRef.current) return
    const ar = arenaRef.current.getBoundingClientRect()
    const tr = el.getBoundingClientRect()
    const x = tr.left - ar.left + tr.width  / 2
    const y = tr.top  - ar.top  + tr.height / 2
    const id = `imp_${Date.now()}_${Math.random()}`
    setImpacts(p => [...p, { id, x, y }])
    setTimeout(() => setImpacts(p => p.filter(i => i.id !== id)), 550)
  }, [])

  function getCardEl(uid: string | number, isEnemy: boolean): HTMLElement | null {
    return arenaRef.current?.querySelector(
      `[data-uid="${uid}"][data-enemy="${isEnemy}"]`
    ) as HTMLElement | null
  }

  function handlePlayerAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    const atkEl = getCardEl(attacker.uid, false)
    const tgtEl = target === 'face'
      ? arenaRef.current?.querySelector('[data-face-enemy]') as HTMLElement | null
      : getCardEl((target as ArenaCard).uid, true)

    shake(attacker.uid)
    if (target !== 'face') shake((target as ArenaCard).uid)
    spawnImpact(tgtEl)
    const dmg = attacker.atk
    setTimeout(() => {
      spawnDmg(tgtEl, dmg)
      if (target !== 'face') spawnDmg(atkEl, (target as ArenaCard).atk)
    }, 150)

    onAttack(attacker, target)
    setSelected(null)
  }

  function handleBoardClick(card: ArenaCard, isEnemy: boolean) {
    if (locked || !myTurn) return
    if (isEnemy) {
      if (selected && !selected.exhausted) handlePlayerAttack(selected, card)
    } else {
      if (!card.exhausted) setSelected(s => s?.uid === card.uid ? null : card)
    }
  }

  function handleFaceClick() {
    if (!selected || locked || !myTurn) return
    const hasTaunt = oppBoard.some(c => (c as ArenaCard & { effects?: string[] }).effects?.includes('taunt'))
    if (hasTaunt) return
    if (oppBoard.length === 0 || !hasTaunt) handlePlayerAttack(selected, 'face')
  }

  const canFace = !!selected && !selected.exhausted && myTurn && !locked
    && !oppBoard.some(c => (c as ArenaCard & { effects?: string[] }).effects?.includes('taunt'))

  const disabled = locked || !myTurn

  return (
    <div className="ca-root" ref={arenaRef}>
      {/* Stars */}
      <div className="ca-stars" />

      {/* Top badge */}
      {topLabel && <div className="ca-top-badge">{topLabel}</div>}

      <div className="ca-arena">
        {/* Damage floats */}
        {dmgPopups.map(d => (
          <div key={d.id} className="ca-dmg-float" style={{ left: d.x, top: d.y }}>-{d.value}</div>
        ))}
        {impacts.map(i => (
          <div key={i.id} className="ca-impact-ring" style={{ left: i.x, top: i.y }} />
        ))}

        {/* ── BOT SIDE ── */}
        <HpRow hp={oppHp} label={oppName} color={hpColor} />
        <ManaRow mana={0} max={0} />

        <div className="ca-face-row">
          <span className="ca-turn-lbl">{turnLabel ?? ''}</span>
          <button
            data-face-enemy
            className={`ca-face-btn${canFace ? ' attackable' : ''}`}
            onClick={handleFaceClick}
            title={oppName}>
            💀
          </button>
          <span style={{ minWidth: 80 }} />
        </div>

        {/* Enemy board */}
        <div className="ca-board ca-board--enemy">
          {oppBoard.length === 0
            ? <span className="ca-board-empty">
                {canFace ? '⚔ Attaquer directement' : 'Plateau adverse vide'}
              </span>
            : oppBoard.map(c => (
              <div key={String(c.uid)} data-uid={c.uid} data-enemy="true" style={{ display: 'contents' }}>
                <CombatCard
                  card={c} isEnemy
                  isAttackable={!!selected && !selected.exhausted && !locked && myTurn}
                  onClick={() => handleBoardClick(c, true)}
                />
              </div>
            ))
          }
        </div>

        {/* Divider */}
        <div className="ca-divider" />

        {/* Player board */}
        <div className="ca-board ca-board--player">
          {myBoard.length === 0
            ? <span className="ca-board-empty">Joue des cartes ici</span>
            : myBoard.map(c => (
              <div key={String(c.uid)} data-uid={c.uid} data-enemy="false" style={{ display: 'contents' }}>
                <CombatCard
                  card={c} isEnemy={false}
                  canAttack={!c.exhausted && myTurn && !locked && !selected}
                  isSelected={selected?.uid === c.uid}
                  onClick={() => handleBoardClick(c, false)}
                />
              </div>
            ))
          }
        </div>

        {/* Controls */}
        <div className="ca-controls">
          <button data-face-player className="ca-face-btn" title={myName}>🔮</button>
          <button className="ca-end-btn" onClick={onEndTurn} disabled={disabled}>
            {disabled ? 'Attente…' : 'Fin du tour'}
          </button>
          <button className="ca-quit-btn" onClick={onSurrender}>✕ Quitter</button>
        </div>

        {/* My mana */}
        <ManaRow mana={myMana} max={myMaxMana} />

        {/* My HP */}
        <HpRow hp={myHp} label={myName} color={myHpColor} />

        {/* Hand */}
        <div className="ca-hand">
          {selected && (
            <span className="ca-hand-hint">{selected.name} — choisissez une cible</span>
          )}
          {myHand.length === 0
            ? <span className="ca-hand-empty">Main vide</span>
            : myHand.map(card => (
              <CombatCard
                key={String(card.uid)}
                card={card} isEnemy={false} isInHand
                canPlay={myTurn && !locked && card.cost <= myMana}
                onClick={() => {
                  if (!myTurn || locked || card.cost > myMana) return
                  onPlayCard(card)
                  setSelected(null)
                }}
              />
            ))
          }
        </div>

        {/* Log */}
        <div className="ca-log">{log || (myTurn && !locked ? 'Ton tour !' : `Tour de ${oppName}…`)}</div>
      </div>
    </div>
  )
}

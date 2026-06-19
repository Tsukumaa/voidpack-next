'use client'
import './combat-arena.css'
import { useState, useCallback, useRef, useEffect } from 'react'
import { CardFrame } from './CardFrame'

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
}

// ── Helpers ────────────────────────────────────────────────────────────────
function hpColor(pct: number) {
  return pct > 0.6 ? '#e05050' : pct > 0.3 ? '#ff9a3d' : '#ff3030'
}
function myHpColor(pct: number) {
  return pct > 0.6 ? '#a080ff' : pct > 0.3 ? '#ff9a3d' : '#ff4040'
}

// ── CombatCard ─────────────────────────────────────────────────────────────
function CombatCard({
  card, isEnemy, canAttack, isSelected, isAttackable, isInHand, canPlay,
  isShaking, onClick, dataUid, dataEnemy,
}: {
  card: ArenaCard
  isEnemy: boolean
  canAttack?: boolean; isSelected?: boolean
  isAttackable?: boolean; isInHand?: boolean; canPlay?: boolean
  isShaking?: boolean
  onClick: () => void
  dataUid?: string | number
  dataEnemy?: string
}) {
  const hpPct = card.currentHp / card.hp

  let cls = 'ca-cw'
  if (isEnemy && !isAttackable) cls += ' ca-cw--enemy'
  if (card.exhausted && !isAttackable) cls += ' ca-cw--exhausted'
  if (canAttack)    cls += ' ca-cw--can-attack'
  if (isSelected)   cls += ' ca-cw--selected'
  if (isAttackable) cls += ' ca-cw--attackable'
  if (isShaking)    cls += ' ca-cw--shaking'
  if (isInHand && !canPlay) cls += ' ca-cw--locked'
  if (isInHand && canPlay)  cls += ' ca-cw--playable'

  return (
    <div
      className={cls}
      onClick={onClick}
      data-uid={dataUid}
      data-enemy={dataEnemy}
    >
      <CardFrame
        rarity={card.rarity}
        name={card.name}
        cost={card.cost}
        atk={card.atk}
        def={card.currentHp}
        size="lg"
        glow={isSelected || !!canAttack || !!isAttackable}
        style={{ width: '100%', height: '100%' }}
      >
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
        ) : null}
      </CardFrame>

      {/* HP bar below card (only on board) */}
      {!isInHand && (
        <div className="ca-cw-hpbar">
          <div style={{
            height: '100%',
            width: `${Math.max(0, hpPct) * 100}%`,
            background: hpPct > 0.5 ? '#50d080' : hpPct > 0.25 ? '#ff9a3d' : '#ff4040',
            transition: 'width .4s',
            borderRadius: 99,
          }} />
        </div>
      )}

      {/* Tooltip */}
      <div className="ca-tooltip">
        <div className="ca-tooltip-name">{card.name}</div>
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

  function getFaceEl(enemy: boolean): HTMLElement | null {
    return arenaRef.current?.querySelector(
      enemy ? '[data-face-enemy]' : '[data-face-player]'
    ) as HTMLElement | null
  }

  function handlePlayerAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    const atkEl = getCardEl(attacker.uid, false)
    const tgtEl = target === 'face'
      ? getFaceEl(true)
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
    if (!hasTaunt) handlePlayerAttack(selected, 'face')
  }

  const canFace = !!selected && !selected.exhausted && myTurn && !locked
    && !oppBoard.some(c => (c as ArenaCard & { effects?: string[] }).effects?.includes('taunt'))

  const disabled = locked || !myTurn
  const oppHpPct = Math.max(0, Math.min(1, oppHp / 30))
  const myHpPct  = Math.max(0, Math.min(1, myHp  / 30))

  return (
    <div className="ca-root" ref={arenaRef}>
      <div className="ca-stars" />

      {topLabel && <div className="ca-top-badge">{topLabel}</div>}

      <div className="ca-arena">
        {/* Damage floats */}
        {dmgPopups.map(d => (
          <div key={d.id} className="ca-dmg-float" style={{ left: d.x, top: d.y }}>-{d.value}</div>
        ))}
        {impacts.map(i => (
          <div key={i.id} className="ca-impact-ring" style={{ left: i.x, top: i.y }} />
        ))}

        {/* ── OPP HERO BAR ── */}
        <div
          className={`ca-hero-bar ca-hero-bar--opp${canFace ? ' ca-hero-bar--attackable' : ''}`}
          onClick={handleFaceClick}
        >
          <div className="ca-hero-inner">
            <div className="ca-hero-portrait ca-hero-portrait--opp" data-face-enemy>💀</div>
            <div className="ca-hero-info">
              <span className="ca-hero-name">{oppName}</span>
              <div className="ca-hero-hpbar">
                <div className="ca-hero-hpfill" style={{ width: `${oppHpPct * 100}%`, background: hpColor(oppHpPct) }} />
              </div>
            </div>
            <div className="ca-hero-hp-num" style={{ color: hpColor(oppHpPct) }}>
              {Math.max(0, oppHp)}<span className="ca-hero-hp-max">/30</span>
            </div>
          </div>
        </div>

        {/* ── OPP BOARD ── */}
        <div className="ca-board ca-board--enemy">
          {oppBoard.length === 0 ? (
            <span className="ca-board-empty">
              {canFace ? '⚔ Cliquez le héros pour attaquer' : 'Plateau adverse vide'}
            </span>
          ) : oppBoard.map(c => (
            <CombatCard
              key={String(c.uid)}
              card={c} isEnemy
              isAttackable={!!selected && !selected.exhausted && !locked && myTurn}
              isShaking={shakingUids.has(c.uid)}
              dataUid={c.uid} dataEnemy="true"
              onClick={() => handleBoardClick(c, true)}
            />
          ))}
        </div>

        {/* ── MID STRIP ── */}
        <div className="ca-mid-strip">
          <div className="ca-divider-line" />
          <div className="ca-mid-center">
            <span className="ca-turn-lbl">
              {turnLabel ?? (myTurn ? 'Ton tour' : `Tour de ${oppName}`)}
            </span>
            <button className="ca-end-btn" onClick={onEndTurn} disabled={disabled}>
              {disabled ? '⌛ Attente…' : 'Fin du tour ▶'}
            </button>
          </div>
          <div className="ca-divider-line" />
        </div>

        {/* ── PLAYER BOARD ── */}
        <div className="ca-board ca-board--player">
          {myBoard.length === 0 ? (
            <span className="ca-board-empty">Joue des cartes ici</span>
          ) : myBoard.map(c => (
            <CombatCard
              key={String(c.uid)}
              card={c} isEnemy={false}
              canAttack={!c.exhausted && myTurn && !locked && !selected}
              isSelected={selected?.uid === c.uid}
              isShaking={shakingUids.has(c.uid)}
              dataUid={c.uid} dataEnemy="false"
              onClick={() => handleBoardClick(c, false)}
            />
          ))}
        </div>

        {/* ── PLAYER HERO BAR ── */}
        <div className="ca-hero-bar ca-hero-bar--player">
          <button className="ca-quit-btn" onClick={onSurrender} title="Quitter">✕</button>

          <div className="ca-hero-inner">
            <div className="ca-hero-portrait ca-hero-portrait--player" data-face-player>🔮</div>
            <div className="ca-hero-info">
              <span className="ca-hero-name">{myName}</span>
              <div className="ca-hero-hpbar">
                <div className="ca-hero-hpfill" style={{ width: `${myHpPct * 100}%`, background: myHpColor(myHpPct) }} />
              </div>
            </div>
            <div className="ca-hero-hp-num" style={{ color: myHpColor(myHpPct) }}>
              {Math.max(0, myHp)}<span className="ca-hero-hp-max">/30</span>
            </div>
          </div>

          <div className="ca-mana-block">
            <div className="ca-mana-row">
              {Array.from({ length: Math.min(myMaxMana, 10) }).map((_, i) => (
                <span key={i} className={`ca-mana-crystal${i < myMana ? ' active' : ''}`} />
              ))}
            </div>
            <span className="ca-mana-lbl">✦ {myMana}/{myMaxMana}</span>
          </div>
        </div>

        {/* ── HAND ── */}
        <div className="ca-hand">
          {selected && (
            <span className="ca-hand-hint">{selected.name} — choisissez une cible</span>
          )}
          {myHand.length === 0 ? (
            <span className="ca-hand-empty">Main vide</span>
          ) : myHand.map(card => (
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
          ))}
        </div>

        {/* ── LOG ── */}
        <div className="ca-log">
          {log || (myTurn && !locked ? 'Ton tour !' : `Tour de ${oppName}…`)}
        </div>
      </div>
    </div>
  )
}

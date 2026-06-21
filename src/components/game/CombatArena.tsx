'use client'
import './combat-arena.css'
import { useState, useCallback, useRef, useEffect } from 'react'
import { CardFrame } from './CardFrame'
import { Gem, Sword, Shield as ShieldIcon } from 'lucide-react'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899', rare: '#4aa3ff', common: '#9ca3af',
}

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
  effects?: string[]
  shieldUsed?: boolean
  image_url?: string | null
}

interface DmgPopup  { id: string; x: number; y: number; value: number }
interface ImpactPop { id: string; x: number; y: number }
interface CardTip   { card: ArenaCard; x: number; y: number }

export interface CombatArenaProps {
  myHp: number; oppHp: number
  myMana: number; myMaxMana: number
  myBoard: ArenaCard[]; oppBoard: ArenaCard[]
  myHand: ArenaCard[]
  myTurn: boolean; locked?: boolean
  myName?: string; oppName?: string
  myAvatar?: string | null; oppAvatar?: string | null
  turnLabel?: string
  topLabel?: React.ReactNode
  arenaBg?: string | null
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
  isShaking, flashClass, onClick, onTipShow, onTipHide, dataUid, dataEnemy,
}: {
  card: ArenaCard
  isEnemy: boolean
  canAttack?: boolean; isSelected?: boolean
  isAttackable?: boolean; isInHand?: boolean; canPlay?: boolean
  isShaking?: boolean
  flashClass?: string
  onClick: () => void
  onTipShow?: (card: ArenaCard, x: number, y: number) => void
  onTipHide?: () => void
  dataUid?: string | number
  dataEnemy?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hpPct = card.currentHp / card.hp
  const fx = card.effects ?? []
  const hasShield   = fx.includes('shield')
  const shieldSpent = card.shieldUsed

  let cls = 'ca-cw'
  if (isEnemy && !isAttackable) cls += ' ca-cw--enemy'
  if (card.exhausted && !isAttackable) cls += ' ca-cw--exhausted'
  if (canAttack)    cls += ' ca-cw--can-attack'
  if (isSelected)   cls += ' ca-cw--selected'
  if (isAttackable) cls += ' ca-cw--attackable'
  if (isShaking)    cls += ' ca-cw--shaking'
  if (isInHand && !canPlay) cls += ' ca-cw--locked'
  if (isInHand && canPlay)  cls += ' ca-cw--playable'
  // Auras permanentes (seulement sur le board, pas en main)
  if (!isInHand) {
    if (fx.includes('taunt'))   cls += ' ca-cw--taunt'
    if (hasShield && !shieldSpent) cls += ' ca-cw--shield'
    if (shieldSpent)            cls += ' ca-cw--shield-used'
    if (fx.includes('stealth')) cls += ' ca-cw--stealth'
  }
  if (flashClass) cls += ` ${flashClass}`

  const hasEffects = !!(card.effects && card.effects.length > 0)

  return (
    <div
      ref={cardRef}
      className={cls}
      onClick={onClick}
      data-uid={dataUid}
      data-enemy={dataEnemy}
      onMouseEnter={hasEffects && onTipShow ? () => {
        const r = cardRef.current?.getBoundingClientRect()
        if (r) onTipShow(card, r.left + r.width / 2, r.top)
      } : undefined}
      onMouseLeave={hasEffects && onTipHide ? onTipHide : undefined}
    >
      <CardFrame
        rarity={card.rarity}
        name={card.name}
        hideStats
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

      {/* Stats en cadres — en bas de la carte */}
      <div className="ca-stat-badges">
        <span className="ca-stat-badge ca-stat-badge--cost" style={{ borderColor: `${RARITY_COLOR[card.rarity] ?? '#9ca3af'}55` }}>
          <Gem size={8} style={{ color: RARITY_COLOR[card.rarity] ?? '#9ca3af' }} />{card.cost}
        </span>
        <span className="ca-stat-badge ca-stat-badge--atk">
          <Sword size={8} style={{ color: '#fca5a5' }} />{card.atk}
        </span>
        <span className="ca-stat-badge ca-stat-badge--def">
          <ShieldIcon size={8} style={{ color: '#93c5fd' }} />{card.currentHp}
        </span>
      </div>

      {/* Badges effets — sous le nom, toujours visibles */}
      {card.effects && card.effects.length > 0 && (
        <div style={{ position: 'absolute', top: '9%', left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: '0 4px', zIndex: 40, pointerEvents: 'none' }}>
          {card.effects.includes('taunt')      && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(200,80,0,.25)', color: '#ffb580', lineHeight: 1.3, border: '1px solid rgba(200,80,0,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>Provocation</span>}
          {card.effects.includes('shield')     && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(0,110,220,.25)', color: '#7ec4ff', lineHeight: 1.3, border: '1px solid rgba(0,110,220,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{card.shieldUsed ? 'Bouclier ✓' : 'Bouclier'}</span>}
          {card.effects.includes('charge')     && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(40,160,40,.25)', color: '#7edc7e', lineHeight: 1.3, border: '1px solid rgba(40,160,40,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>Charge</span>}
          {card.effects.includes('lifesteal')  && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(180,20,60,.25)', color: '#ff7090', lineHeight: 1.3, border: '1px solid rgba(180,20,60,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>Vol de vie</span>}
          {card.effects.includes('void_surge') && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(100,0,220,.25)', color: '#c070ff', lineHeight: 1.3, border: '1px solid rgba(100,0,220,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>VOID Surge</span>}
          {card.effects.includes('stealth')    && <span style={{ fontSize: '7px', fontWeight: 600, padding: '2px 4px', borderRadius: 4, background: 'rgba(100,100,140,.25)', color: '#c0c0e0', lineHeight: 1.3, border: '1px solid rgba(100,100,140,.9)', boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>Furtivité</span>}
        </div>
      )}

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

    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export function CombatArena({
  myHp, oppHp, myMana, myMaxMana,
  myBoard, oppBoard, myHand,
  myTurn, locked = false,
  myName = 'Toi', oppName = 'Bot',
  myAvatar, oppAvatar,
  turnLabel, topLabel, arenaBg,
  onPlayCard, onAttack, onEndTurn, onSurrender,
  log = '',
}: CombatArenaProps) {
  const [selected, setSelected] = useState<ArenaCard | null>(null)
  const [shakingUids, setShakingUids] = useState<Set<string | number>>(new Set())
  const [dmgPopups,  setDmgPopups]  = useState<DmgPopup[]>([])
  const [impacts,    setImpacts]    = useState<ImpactPop[]>([])
  const [timeLeft,   setTimeLeft]   = useState(60)
  const [flashUids,  setFlashUids]  = useState<Map<string | number, string>>(new Map())
  const [healFlash,     setHealFlash]     = useState(false)
  const [oppHealFlash,  setOppHealFlash]  = useState(false)
  const [cardTip,       setCardTip]       = useState<CardTip | null>(null)

  const showCardTip = useCallback((card: ArenaCard, x: number, y: number) => setCardTip({ card, x, y }), [])
  const hideCardTip = useCallback(() => setCardTip(null), [])
  const arenaRef = useRef<HTMLDivElement>(null)

  // Refs pour détecter les diffs de board (animations adversaire + spectateur)
  const prevOppBoard = useRef<ArenaCard[]>([])
  const prevMyBoard  = useRef<ArenaCard[]>([])
  const prevOppHp    = useRef<number>(oppHp)
  const prevMyHp     = useRef<number>(myHp)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevOppBoard.current = oppBoard
      prevMyBoard.current  = myBoard
      prevOppHp.current    = oppHp
      prevMyHp.current     = myHp
      return
    }
    // Laisser le DOM se mettre à jour avant de chercher les éléments
    requestAnimationFrame(() => {
      // ── Cartes adversaire ──────────────────────────────────────
      for (const card of oppBoard) {
        const prev = prevOppBoard.current.find(c => c.uid === card.uid)
        if (prev) {
          // Dégâts
          if (card.currentHp < prev.currentHp) {
            shake(card.uid)
            spawnDmg(getCardEl(card.uid, true), prev.currentHp - card.currentHp)
            spawnImpact(getCardEl(card.uid, true))
          }
          // Shield consommé → flash absorb
          if (!prev.shieldUsed && card.shieldUsed) {
            flashCard(card.uid, 'ca-cw--shield-absorb', 550)
          }
        } else {
          // Nouvelle carte jouée par l'adversaire
          if (card.effects?.includes('charge')) flashCard(card.uid, 'ca-cw--charge-flash', 650)
          if (card.effects?.includes('void_surge')) {
            // Onde void sur toutes mes cartes
            myBoard.forEach(c => flashCard(c.uid, 'ca-cw--void-hit', 600))
          }
        }
      }
      // ── Mes cartes ─────────────────────────────────────────────
      for (const card of myBoard) {
        const prev = prevMyBoard.current.find(c => c.uid === card.uid)
        if (prev) {
          // Dégâts
          if (card.currentHp < prev.currentHp) {
            shake(card.uid)
            spawnDmg(getCardEl(card.uid, false), prev.currentHp - card.currentHp)
            spawnImpact(getCardEl(card.uid, false))
          }
          // Shield consommé par attaque adverse
          if (!prev.shieldUsed && card.shieldUsed) {
            flashCard(card.uid, 'ca-cw--shield-absorb', 550)
          }
        }
      }
      // ── Visages ────────────────────────────────────────────────
      if (oppHp < prevOppHp.current) spawnDmg(getFaceEl(true), prevOppHp.current - oppHp)
      if (myHp  < prevMyHp.current)  spawnDmg(getFaceEl(false), prevMyHp.current - myHp)
      // Lifesteal adversaire : son HP monte
      if (oppHp > prevOppHp.current) { setOppHealFlash(true); setTimeout(() => setOppHealFlash(false), 700) }
      // Lifesteal moi : mon HP monte (côté spectateur / adversaire)
      if (myHp  > prevMyHp.current)  triggerHealFlash()

      prevOppBoard.current = oppBoard
      prevMyBoard.current  = myBoard
      prevOppHp.current    = oppHp
      prevMyHp.current     = myHp
    })
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSelected(null); setTimeLeft(60) }, [myTurn])

  useEffect(() => {
    if (!myTurn || locked) return
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); onEndTurn(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [myTurn, locked]) // eslint-disable-line

  const shake = useCallback((uid: string | number) => {
    setShakingUids(s => new Set([...s, uid]))
    setTimeout(() => setShakingUids(s => { const n = new Set(s); n.delete(uid); return n }), 350)
  }, [])

  const flashCard = useCallback((uid: string | number, cls: string, duration = 600) => {
    setFlashUids(m => new Map([...m, [uid, cls]]))
    setTimeout(() => setFlashUids(m => { const n = new Map(m); n.delete(uid); return n }), duration)
  }, [])

  const triggerHealFlash = useCallback(() => {
    setHealFlash(true)
    setTimeout(() => setHealFlash(false), 700)
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

  // Charge style Hearthstone : la carte fonce vers sa cible, frappe, puis revient
  function lunge(atkEl: HTMLElement | null, tgtEl: HTMLElement | null, onContact: () => void) {
    if (!atkEl || !tgtEl) { onContact(); return }
    const a = atkEl.getBoundingClientRect()
    const t = tgtEl.getBoundingClientRect()
    const dx = (t.left + t.width / 2) - (a.left + a.width / 2)
    const dy = (t.top  + t.height / 2) - (a.top  + a.height / 2)
    const f = 0.78 // s'arrête juste avant la cible (effet d'impact)

    atkEl.style.zIndex = '60'
    atkEl.style.transition = 'transform .16s cubic-bezier(.55,0,.9,.45)'
    atkEl.style.transform  = `translate(${dx * f}px, ${dy * f}px) scale(1.06)`

    setTimeout(() => {
      onContact()
      atkEl.style.transition = 'transform .24s cubic-bezier(.2,.7,.4,1)'
      atkEl.style.transform  = ''
      setTimeout(() => { atkEl.style.zIndex = ''; atkEl.style.transition = '' }, 250)
    }, 160)
  }

  function handlePlayerAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    const atkEl = getCardEl(attacker.uid, false)
    const tgtEl = target === 'face'
      ? getFaceEl(true)
      : getCardEl((target as ArenaCard).uid, true)

    setSelected(null)

    lunge(atkEl, tgtEl, () => {
      shake(attacker.uid)
      if (target !== 'face') shake((target as ArenaCard).uid)
      spawnImpact(tgtEl)
      spawnDmg(tgtEl, attacker.atk)
      if (target !== 'face') spawnDmg(atkEl, (target as ArenaCard).atk)
      // Shield absorb flash
      if (target !== 'face') {
        const t = target as ArenaCard
        if (t.effects?.includes('shield') && !t.shieldUsed) flashCard(t.uid, 'ca-cw--shield-absorb', 550)
      }
      if (attacker.effects?.includes('shield') && !attacker.shieldUsed && target !== 'face') {
        flashCard(attacker.uid, 'ca-cw--shield-absorb', 550)
      }
      // Lifesteal heal flash
      if (attacker.effects?.includes('lifesteal')) triggerHealFlash()
      onAttack(attacker, target)
    })
  }

  function handleBoardClick(card: ArenaCard, isEnemy: boolean) {
    if (locked || !myTurn) return
    if (isEnemy) {
      if (selected && !selected.exhausted) {
        // Stealth : ne peut pas être ciblé sauf si c'est la seule carte
        const targetable = oppBoard.filter(c => !c.effects?.includes('stealth'))
        if (card.effects?.includes('stealth') && targetable.length > 0) return
        handlePlayerAttack(selected, card)
      }
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
    <div
      className="ca-root"
      ref={arenaRef}
      style={arenaBg ? ({ '--ca-arena-bg': `url("${arenaBg}")` } as React.CSSProperties) : undefined}
    >
      <div className="ca-stars" />

      {/* Tooltip effets — rendu dans ca-root hors de ca-arena (overflow:hidden) */}
      {cardTip && cardTip.card.effects && cardTip.card.effects.length > 0 && (
        <div className="ca-tooltip--portal" style={{ left: cardTip.x, top: cardTip.y }}>
          <div className="ca-tooltip-name">{cardTip.card.name}</div>
          <div className="ca-tooltip-stats">
            <span className="ca-tooltip-stat ca-tooltip-stat--atk">⚔ {cardTip.card.atk}</span>
            <span className="ca-tooltip-stat ca-tooltip-stat--hp">♥ {cardTip.card.currentHp}/{cardTip.card.hp}</span>
            <span className="ca-tooltip-stat ca-tooltip-stat--cost">✦ {cardTip.card.cost}</span>
          </div>
          <div className="ca-tooltip-effects">
            {cardTip.card.effects.includes('taunt')      && <span className="ca-tooltip-effect ca-tooltip-effect--taunt">Provocation</span>}
            {cardTip.card.effects.includes('charge')     && <span className="ca-tooltip-effect ca-tooltip-effect--charge">Charge</span>}
            {cardTip.card.effects.includes('shield')     && <span className={`ca-tooltip-effect ca-tooltip-effect--shield${cardTip.card.shieldUsed ? ' ca-tooltip-effect--used' : ''}`}>{cardTip.card.shieldUsed ? 'Bouclier (utilisé)' : 'Bouclier'}</span>}
            {cardTip.card.effects.includes('lifesteal')  && <span className="ca-tooltip-effect ca-tooltip-effect--lifesteal">Vol de vie</span>}
            {cardTip.card.effects.includes('void_surge') && <span className="ca-tooltip-effect ca-tooltip-effect--void">VOID Surge</span>}
            {cardTip.card.effects.includes('stealth')    && <span className="ca-tooltip-effect ca-tooltip-effect--stealth">Furtivité</span>}
          </div>
        </div>
      )}

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
            <div className={`ca-hero-portrait ca-hero-portrait--opp${oppHealFlash ? ' ca-heal-flash' : ''}`} data-face-enemy>
              {oppAvatar
                ? <img src={oppAvatar} alt={oppName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : '💀'}
            </div>
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
              isAttackable={!!selected && !selected.exhausted && !locked && myTurn && (!c.effects?.includes('stealth') || oppBoard.every(c2 => c2.effects?.includes('stealth')))}
              isShaking={shakingUids.has(c.uid)}
              flashClass={flashUids.get(c.uid)}
              onTipShow={showCardTip} onTipHide={hideCardTip}
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
            {myTurn && !locked && (
              <span className={`ca-timer-lbl${timeLeft <= 10 ? ' ca-timer-lbl--urgent' : ''}`}>
                {timeLeft}s
              </span>
            )}
          </div>
          <div className="ca-divider-line" />
        </div>
        {/* ── ROPE ── */}
        {myTurn && !locked && (
          <div className="ca-rope">
            <div
              className={`ca-rope-fill${timeLeft <= 10 ? ' ca-rope-fill--urgent' : ''}`}
              style={{ width: `${(timeLeft / 60) * 100}%` }}
            />
          </div>
        )}

        {/* ── PLAYER BOARD ── */}
        <div className={`ca-board ca-board--player${myTurn && !locked ? ' ca-board--myturn' : ''}`}>
          {myBoard.length === 0 ? (
            <span className="ca-board-empty">Joue des cartes ici</span>
          ) : myBoard.map(c => (
            <CombatCard
              key={String(c.uid)}
              card={c} isEnemy={false}
              canAttack={!c.exhausted && myTurn && !locked && !selected}
              isSelected={selected?.uid === c.uid}
              isShaking={shakingUids.has(c.uid)}
              flashClass={flashUids.get(c.uid)}
              onTipShow={showCardTip} onTipHide={hideCardTip}
              dataUid={c.uid} dataEnemy="false"
              onClick={() => handleBoardClick(c, false)}
            />
          ))}
        </div>

        {/* ── PLAYER HERO BAR ── */}
        <div className="ca-hero-bar ca-hero-bar--player">
          <button className="ca-quit-btn" onClick={onSurrender} title="Quitter">✕</button>

          <div className="ca-hero-inner">
            <div className={`ca-hero-portrait ca-hero-portrait--player${healFlash ? ' ca-heal-flash' : ''}`} data-face-player>
              {myAvatar
                ? <img src={myAvatar} alt={myName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : '🔮'}
            </div>
            <div className="ca-hero-info">
              <span className="ca-hero-name">{myName}</span>
              <div className="ca-hero-hpbar">
                <div className="ca-hero-hpfill" style={{ width: `${myHpPct * 100}%`, background: myHpColor(myHpPct) }} />
              </div>
              <div className="ca-mana-row">
                {Array.from({ length: Math.min(myMaxMana, 10) }).map((_, i) => (
                  <span key={i} className={`ca-mana-crystal${i < myMana ? ' active' : ''}`} />
                ))}
              </div>
            </div>
            <div className="ca-hero-right-col">
              <div className="ca-hero-hp-num" style={{ color: myHpColor(myHpPct) }}>
                {Math.max(0, myHp)}<span className="ca-hero-hp-max">/30</span>
              </div>
              <span className="ca-mana-lbl">✦ {myMana}/{myMaxMana}</span>
            </div>
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
              onTipShow={showCardTip} onTipHide={hideCardTip}
              onClick={() => {
                if (!myTurn || locked || card.cost > myMana) return
                // Flash charge (carte peut attaquer immédiatement)
                if (card.effects?.includes('charge')) {
                  setTimeout(() => flashCard(card.uid, 'ca-cw--charge-flash', 650), 100)
                }
                // Flash void sur toutes les cartes ennemies
                if (card.effects?.includes('void_surge')) {
                  oppBoard.forEach(c => flashCard(c.uid, 'ca-cw--void-hit', 600))
                }
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

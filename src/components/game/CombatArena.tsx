'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}

export interface ArenaCard {
  uid: string; id: string; name: string; rarity: string
  atk: number; hp: number; currentHp: number; cost: number
  exhausted: boolean; image_url?: string | null
}

interface FloatPopup { id: string; value: number }

export interface CombatArenaProps {
  myHp: number; oppHp: number
  myMana: number; myMaxMana: number
  myBoard: ArenaCard[]; oppBoard: ArenaCard[]
  myHand: ArenaCard[]
  myDeckCount?: number; oppHandCount?: number; oppDeckCount?: number
  myTurn: boolean
  myName?: string; oppName?: string
  myAvatar?: string | null; oppAvatar?: string | null
  topLabel?: React.ReactNode
  onPlayCard: (card: ArenaCard) => void
  onAttack: (attacker: ArenaCard, target: ArenaCard | 'face') => void
  onEndTurn: () => void
  onSurrender: () => void
  log?: string[]
  disabled?: boolean
}

// ── HP bar full-width ──────────────────────────────────────────────────────
function HpBar({ hp, maxHp = 30, name, color, popups = [] }: {
  hp: number; maxHp?: number; name: string; color: string; popups?: FloatPopup[]
}) {
  const pct = Math.max(0, Math.min(1, hp / maxHp)) * 100
  return (
    <div className="relative flex items-center gap-3 px-5 py-1.5 flex-shrink-0">
      {popups.map(p => (
        <div key={p.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 font-black text-2xl pointer-events-none animate-damage-float"
          style={{ color: '#ff4757', textShadow: '0 0 14px #ff4757' }}>
          -{p.value}
        </div>
      ))}
      <span className="text-xs font-bold min-w-[40px]" style={{ color }}>{name}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-full transition-all duration-500 relative" style={{ width: `${pct}%`, background: color }}>
          <div className="absolute top-0 left-0 right-0 h-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>
      </div>
      <span className="text-xs font-bold min-w-[52px] text-right" style={{ color }}>{hp} / {maxHp}</span>
    </div>
  )
}

// ── Mana crystals ──────────────────────────────────────────────────────────
function ManaRow({ mana, max, align = 'left' }: { mana: number; max: number; align?: 'left' | 'right' }) {
  if (max === 0) return null
  return (
    <div className={cn('flex gap-1 px-5 py-0.5 flex-shrink-0 items-center', align === 'right' && 'justify-end')}>
      {Array.from({ length: Math.min(max, 10) }).map((_, i) => (
        <div key={i} className="w-3 h-3 rounded-full border transition-all duration-300"
          style={{
            background: i < mana ? 'linear-gradient(135deg,#4aa3ff,#2563eb)' : 'transparent',
            borderColor: i < mana ? '#4aa3ff88' : '#ffffff15',
            boxShadow: i < mana ? '0 0 5px #4aa3ff55' : 'none',
          }} />
      ))}
      <span className="text-[10px] font-bold ml-1" style={{ color: '#4aa3ff' }}>{mana}/{max}</span>
    </div>
  )
}

// ── Face button ────────────────────────────────────────────────────────────
function FaceBtn({ emoji, label, isTarget, onClick }: {
  emoji: string; label: string; isTarget?: boolean; onClick?: () => void
}) {
  return (
    <button onClick={onClick} disabled={!isTarget}
      title={label}
      className={cn(
        'w-10 h-10 rounded-full text-xl flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0',
        isTarget
          ? 'border-[#ff5050] cursor-crosshair bg-[#ff5050]/10 shadow-[0_0_16px_rgba(255,60,60,0.5)] animate-pulse'
          : 'border-white/10 cursor-default bg-white/[0.03]'
      )}>
      {emoji}
    </button>
  )
}

// ── Board card ─────────────────────────────────────────────────────────────
function BoardCard({ card, selected, targetable, selectable, onClick, shaking }: {
  card: ArenaCard; selected: boolean; targetable: boolean
  selectable: boolean; onClick: () => void; shaking?: boolean
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const hpPct = Math.max(0, card.currentHp / card.hp) * 100
  const hpColor = hpPct > 60 ? '#50d080' : hpPct > 30 ? '#ff9a3d' : '#ff4757'

  return (
    <div onClick={onClick}
      className={cn(
        'relative flex-shrink-0 rounded-xl overflow-hidden border transition-all duration-150 group',
        'w-[108px] sm:w-[130px]',
        selected   ? 'border-[#c084ff] -translate-y-2.5 cursor-pointer shadow-[0_0_30px_rgba(185,124,255,0.7)]' : '',
        targetable ? 'border-[#ff5050] cursor-crosshair shadow-[0_0_24px_rgba(255,60,60,0.6)] animate-pulse' : '',
        selectable && !selected && !targetable ? 'border-white/10 hover:border-white/30 hover:-translate-y-2 cursor-pointer' : '',
        !selectable && !targetable && !selected ? 'border-white/10 cursor-default' : '',
        card.exhausted && !targetable ? 'opacity-40 grayscale-[0.6]' : '',
        shaking ? 'animate-shake' : '',
      )}
      style={{
        aspectRatio: '0.716',
        background: 'linear-gradient(180deg, rgba(30,18,60,.95) 0%, rgba(8,4,20,.98) 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.06)',
      }}>

      <div className="absolute top-0 left-0 right-0 h-0.5 z-10" style={{ background: color }} />

      <div className="absolute inset-0">
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover object-top" unoptimized />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: `radial-gradient(ellipse at 50% 40%, ${color}20, transparent 70%)` }}>
              <span className="text-3xl opacity-20">?</span>
            </div>
        }
      </div>

      {/* Cost */}
      <div className="absolute top-1.5 left-1.5 z-20 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white/30"
        style={{ background: 'linear-gradient(135deg,#4aa3ff,#2563eb)', boxShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
        {card.cost}
      </div>

      {/* HP bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/70 z-10">
        <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, background: hpColor }} />
      </div>

      {/* Stats */}
      <div className="absolute bottom-1.5 left-0 right-0 z-20 flex justify-between px-1.5">
        <span className="text-[10px] font-black" style={{ color: '#ff7050', textShadow: '0 1px 4px #000' }}>⚔{card.atk}</span>
        <span className="text-[10px] font-black" style={{ color: hpColor, textShadow: '0 1px 4px #000' }}>♥{card.currentHp}</span>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 pointer-events-none w-32">
        <div className="bg-[#08031a]/97 border border-[#b97cff]/30 rounded-xl px-3 py-2 text-center shadow-xl">
          <p className="text-white text-[10px] font-black mb-1">{card.name}</p>
          <div className="flex justify-center gap-2 text-[9px]">
            <span style={{ color: '#ff7050' }}>⚔ {card.atk}</span>
            <span style={{ color: '#50d080' }}>♥ {card.currentHp}/{card.hp}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Hand card (fanned with overlap) ───────────────────────────────────────
function HandCard({ card, canPlay, onClick, index, total }: {
  card: ArenaCard; canPlay: boolean; onClick: () => void; index: number; total: number
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const [hovered, setHovered] = useState(false)
  // Fan rotation: spread cards like a hand of cards
  const midIdx = (total - 1) / 2
  const rotation = (index - midIdx) * 3.5
  const translateY = Math.abs(index - midIdx) * 3

  return (
    <button onClick={onClick} disabled={!canPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex-shrink-0 rounded-xl border overflow-visible transition-all duration-150 select-none',
        'w-[108px] sm:w-[130px] -ml-5 first:ml-0',
        canPlay ? 'cursor-pointer hover:z-20' : 'cursor-not-allowed opacity-40',
      )}
      style={{
        aspectRatio: '0.716',
        background: 'linear-gradient(180deg, rgba(30,18,60,.95) 0%, rgba(8,4,20,.98) 100%)',
        border: hovered && canPlay ? '1.5px solid #c084ff' : '1.5px solid rgba(185,124,255,0.2)',
        boxShadow: canPlay
          ? `0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.06)${hovered ? `, 0 0 20px ${color}44` : ''}`
          : '0 4px 16px rgba(0,0,0,0.4)',
        transform: hovered && canPlay
          ? 'translateY(-28px) scale(1.1) rotate(0deg)'
          : `translateY(${translateY}px) scale(1) rotate(${rotation}deg)`,
        transformOrigin: 'bottom center',
        zIndex: hovered ? 20 : index,
      }}>

      <div className="absolute top-0 left-0 right-0 h-0.5 z-10" style={{ background: color }} />

      <div className="absolute inset-0 rounded-xl overflow-hidden">
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover object-top" unoptimized />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: `radial-gradient(ellipse at 50% 40%, ${color}20, transparent 70%)` }}>
              <span className="text-3xl opacity-20">?</span>
            </div>
        }
      </div>

      {/* Cost */}
      <div className="absolute top-1.5 left-1.5 z-20 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white/30"
        style={{ background: 'linear-gradient(135deg,#4aa3ff,#2563eb)', boxShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
        {card.cost}
      </div>

      {/* Stats bottom */}
      <div className="absolute bottom-1.5 left-0 right-0 z-20 flex justify-between px-1.5">
        <span className="text-[10px] font-black" style={{ color: '#ff7050', textShadow: '0 1px 4px #000' }}>⚔{card.atk}</span>
        <span className="text-[10px] font-black" style={{ color: '#50d080', textShadow: '0 1px 4px #000' }}>♥{card.hp}</span>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none w-32" style={{ transform: `translateX(-50%) rotate(${-rotation}deg)` }}>
          <div className="bg-[#08031a]/97 border border-[#b97cff]/30 rounded-xl px-3 py-2 text-center shadow-xl">
            <p className="text-white text-[10px] font-black mb-1">{card.name}</p>
            <div className="flex justify-center gap-2 text-[9px]">
              <span style={{ color: '#ff7050' }}>⚔ {card.atk}</span>
              <span style={{ color: '#50d080' }}>♥ {card.hp}</span>
              <span style={{ color: '#4aa3ff' }}>💧 {card.cost}</span>
            </div>
            {!canPlay && <p className="text-white/30 text-[9px] mt-1">Pas assez de mana</p>}
          </div>
        </div>
      )}
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export function CombatArena({
  myHp, oppHp, myMana, myMaxMana,
  myBoard, oppBoard, myHand,
  myTurn, myName = 'Toi', oppName = 'Bot',
  topLabel,
  onPlayCard, onAttack, onEndTurn, onSurrender,
  log = [], disabled = false,
}: CombatArenaProps) {
  const [selectedCard, setSelectedCard] = useState<ArenaCard | null>(null)
  const [shakingUids, setShakingUids]   = useState<Set<string>>(new Set())
  const [myPopups,  setMyPopups]  = useState<FloatPopup[]>([])
  const [oppPopups, setOppPopups] = useState<FloatPopup[]>([])
  const prevMyHp  = useRef(myHp)
  const prevOppHp = useRef(oppHp)

  const shake = useCallback((uid: string) => {
    setShakingUids(s => new Set([...s, uid]))
    setTimeout(() => setShakingUids(s => { const n = new Set(s); n.delete(uid); return n }), 450)
  }, [])

  const addPopup = useCallback((side: 'my' | 'opp', value: number) => {
    const popup: FloatPopup = { id: `${side}_${Date.now()}_${Math.random()}`, value }
    if (side === 'my') setMyPopups(p => [...p, popup])
    else setOppPopups(p => [...p, popup])
    setTimeout(() => {
      if (side === 'my') setMyPopups(p => p.filter(x => x.id !== popup.id))
      else setOppPopups(p => p.filter(x => x.id !== popup.id))
    }, 900)
  }, [])

  useEffect(() => {
    if (oppHp < prevOppHp.current) addPopup('opp', prevOppHp.current - oppHp)
    if (myHp  < prevMyHp.current)  addPopup('my',  prevMyHp.current  - myHp)
    prevOppHp.current = oppHp
    prevMyHp.current  = myHp
  }, [oppHp, myHp, addPopup])

  function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    shake(attacker.uid)
    if (target !== 'face') shake(target.uid)
    onAttack(attacker, target)
    setSelectedCard(null)
  }

  function handleBoardClick(card: ArenaCard, isOpp: boolean) {
    if (disabled || !myTurn) return
    if (isOpp) {
      if (selectedCard && !selectedCard.exhausted) handleAttack(selectedCard, card)
    } else {
      if (!card.exhausted) setSelectedCard(s => s?.uid === card.uid ? null : card)
    }
  }

  const canAttackFace = !!(selectedCard && !selectedCard.exhausted && oppBoard.length === 0)
  const lastLog = log[0] ?? (myTurn ? 'Ton tour !' : `Tour de ${oppName}…`)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#09060f 0%,#0d0920 50%,#06030e 100%)' }}>

      {/* Ambient bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1/2"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,40,40,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/2"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(123,43,255,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* Top label (training badge etc) */}
      {topLabel && (
        <div className="relative z-20 flex justify-center pt-1.5 flex-shrink-0">{topLabel}</div>
      )}

      {/* ── BOT HP ── */}
      <HpBar hp={oppHp} name={oppName} color="#ff8080" popups={oppPopups} />

      {/* Face row top (turn label · bot face · spacer) */}
      <div className="relative z-10 flex items-center justify-between px-5 py-0.5 flex-shrink-0">
        <span className="text-[11px] text-white/25 font-medium">{lastLog}</span>
        <FaceBtn emoji="💀" label={oppName} isTarget={canAttackFace}
          onClick={() => canAttackFace && handleAttack(selectedCard!, 'face')} />
        <span className="w-24" />
      </div>

      {/* ── ENEMY BOARD ── */}
      <div className={cn(
        'relative z-10 flex-1 flex items-center justify-center gap-3 sm:gap-5 px-5 overflow-x-auto scrollbar-hide flex-shrink-0',
        'border-t border-b transition-all duration-200',
        selectedCard && !selectedCard.exhausted && oppBoard.length > 0
          ? 'bg-[#ff2828]/[0.05] border-[#ff5050]/20'
          : 'bg-[#ff2828]/[0.03] border-[#ff3030]/[0.06]',
      )} style={{ minHeight: '150px' }}>
        {oppBoard.length === 0
          ? <span className={cn('text-xs font-bold transition-colors', canAttackFace ? 'text-[#ff5050]/60 animate-pulse' : 'text-white/10')}>
              {canAttackFace ? '⚔ Attaquer directement' : 'Plateau adverse vide'}
            </span>
          : oppBoard.map(c => (
            <BoardCard key={c.uid} card={c} selected={false} selectable={false}
              targetable={!!selectedCard && !selectedCard.exhausted}
              onClick={() => handleBoardClick(c, true)} shaking={shakingUids.has(c.uid)} />
          ))
        }
      </div>

      {/* ── DIVIDER ── */}
      <div className="relative z-10 flex-shrink-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,243,255,.15) 20%, rgba(185,124,255,.55) 50%, rgba(0,243,255,.15) 80%, transparent 100%)' }} />

      {/* ── MY BOARD ── */}
      <div className={cn(
        'relative z-10 flex-1 flex items-center justify-center gap-3 sm:gap-5 px-5 overflow-x-auto scrollbar-hide flex-shrink-0',
        'border-t border-b transition-all duration-200',
        selectedCard
          ? 'bg-[#7b2bff]/[0.06] border-[#7b2bff]/20'
          : 'bg-[#7b2bff]/[0.03] border-[#7b2bff]/[0.08]',
      )} style={{ minHeight: '150px' }}>
        {myBoard.length === 0
          ? <span className="text-white/10 text-xs font-bold">Joue des cartes ici</span>
          : myBoard.map(c => (
            <BoardCard key={c.uid} card={c}
              selected={selectedCard?.uid === c.uid}
              selectable={myTurn && !disabled}
              targetable={false}
              onClick={() => handleBoardClick(c, false)} shaking={shakingUids.has(c.uid)} />
          ))
        }
      </div>

      {/* Face row bottom (player face · End Turn · Quit) */}
      <div className="relative z-10 flex items-center justify-between px-5 py-1.5 flex-shrink-0">
        <FaceBtn emoji="🔮" label={myName} />
        <button onClick={onEndTurn} disabled={!myTurn || disabled}
          className={cn(
            'px-7 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-150 relative overflow-hidden',
            myTurn && !disabled ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed'
          )}
          style={myTurn && !disabled ? {
            background: 'linear-gradient(135deg, #4a1fa8 0%, #7b2bff 60%, #00c8ff 100%)',
            color: '#fff',
            boxShadow: '0 0 20px rgba(123,43,255,.5), 0 4px 16px rgba(0,0,0,.4)',
          } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>
          {myTurn && !disabled ? 'Fin du tour' : 'Attente…'}
        </button>
        <button onClick={onSurrender} className="text-xs font-bold text-white/20 hover:text-red-400 transition-colors w-24 text-right">
          ✕ Quitter
        </button>
      </div>

      {/* Mana */}
      <ManaRow mana={myMana} max={myMaxMana} />

      {/* ── MY HP ── */}
      <HpBar hp={myHp} name={myName} color="#a080ff" popups={myPopups} />

      {/* ── HAND ── */}
      <div className="relative z-10 flex-shrink-0 flex items-end justify-center overflow-visible"
        style={{
          minHeight: '175px',
          background: 'linear-gradient(0deg, rgba(0,0,0,.55) 0%, rgba(8,3,26,.3) 100%)',
          borderTop: '1px solid rgba(123,43,255,.1)',
          paddingTop: '20px',
          paddingBottom: '14px',
          paddingLeft: '24px',
          paddingRight: '24px',
        }}>
        {selectedCard && (
          <p className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[#a78bfa] text-[10px] font-bold animate-pulse whitespace-nowrap z-30">
            {selectedCard.name} sélectionnée — clique une cible
          </p>
        )}
        {myHand.length === 0
          ? <span className="text-white/10 text-xs mb-4">Main vide</span>
          : myHand.map((card, i) => (
            <HandCard key={card.uid} card={card} index={i} total={myHand.length}
              canPlay={myTurn && !disabled && card.cost <= myMana}
              onClick={() => { onPlayCard(card); setSelectedCard(null) }}
            />
          ))
        }
      </div>

      {/* Log bar */}
      <div className="relative z-10 flex-shrink-0 py-1 text-center"
        style={{ background: 'rgba(0,0,0,0.45)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <span className="text-[10px] text-white/30">{lastLog}</span>
      </div>
    </div>
  )
}

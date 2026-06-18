'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Flag, Shield, Swords } from 'lucide-react'
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

interface FloatPopup { id: string; value: number; isHeal?: boolean }

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

// ── Floating damage number ─────────────────────────────────────────────────
function DmgFloat({ value, isHeal }: { value: number; isHeal?: boolean }) {
  return (
    <div className={cn(
      'absolute left-1/2 -translate-x-1/2 -top-3 z-50 font-black text-lg pointer-events-none animate-damage-float',
      isHeal ? 'text-[#00c896]' : 'text-[#ff4757]'
    )} style={{ textShadow: `0 0 12px ${isHeal ? '#00c896' : '#ff4757'}` }}>
      {isHeal ? '+' : '-'}{value}
    </div>
  )
}

// ── Card in hand ───────────────────────────────────────────────────────────
function HandCard({ card, canPlay, onClick }: { card: ArenaCard; canPlay: boolean; onClick: () => void }) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  return (
    <button onClick={onClick} disabled={!canPlay}
      className={cn(
        'relative flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-200 group select-none',
        'w-[72px] sm:w-[80px]',
        canPlay
          ? 'border-transparent hover:border-[#7b2bff] hover:-translate-y-4 hover:scale-110 hover:z-20 cursor-pointer'
          : 'border-transparent opacity-40 cursor-not-allowed grayscale-[0.5]'
      )}
      style={{ boxShadow: canPlay ? `0 8px 24px ${color}44` : undefined }}
    >
      {/* Card art */}
      <div className="aspect-[0.714] relative" style={{ background: `linear-gradient(160deg,${color}30,#050310)` }}>
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover" unoptimized />
          : <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">?</div>
        }
        {/* Rarity top border */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />
        {/* Mana cost gem */}
        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white/30 shadow-md"
          style={{ background: 'linear-gradient(135deg,#4aa3ff,#2563eb)' }}>
          {card.cost}
        </div>
      </div>
      {/* Stats bar */}
      <div className="flex items-center justify-between px-2 py-1" style={{ background: '#0a0816' }}>
        <span className="text-[10px] font-black" style={{ color: '#ff6b6b' }}>⚔{card.atk}</span>
        <span className="text-[9px] text-white/30 truncate max-w-[36px] text-center">{card.name.split(' ')[0]}</span>
        <span className="text-[10px] font-black" style={{ color: '#00c896' }}>♥{card.hp}</span>
      </div>
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none w-36">
        <div className="bg-black/95 border border-white/20 rounded-xl px-3 py-2 text-center shadow-xl">
          <p className="text-white text-[11px] font-black mb-1">{card.name}</p>
          <div className="flex justify-center gap-3 text-[10px]">
            <span style={{ color: '#ff6b6b' }}>⚔ {card.atk}</span>
            <span style={{ color: '#00c896' }}>♥ {card.hp}</span>
            <span style={{ color: '#4aa3ff' }}>💧 {card.cost}</span>
          </div>
        </div>
        <div className="w-2 h-2 bg-black/95 rotate-45 border-b border-r border-white/20 -mt-1" />
      </div>
    </button>
  )
}

// ── Card on board ──────────────────────────────────────────────────────────
function BoardCard({
  card, selectable, selected, targetable, onClick, shaking
}: {
  card: ArenaCard; selectable: boolean; selected: boolean
  targetable: boolean; onClick: () => void; shaking?: boolean
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const hpPct = Math.max(0, (card.currentHp / card.hp) * 100)
  const hpCol = hpPct > 60 ? '#00c896' : hpPct > 30 ? '#ff9a3d' : '#ff4757'

  return (
    <button onClick={onClick}
      className={cn(
        'relative rounded-2xl overflow-hidden border-2 transition-all duration-150 group select-none',
        'w-[68px] sm:w-[76px]',
        selected ? 'border-[#7b2bff] -translate-y-2 scale-105 z-20' : '',
        targetable ? 'border-[#ff4757] hover:scale-105 hover:-translate-y-1 cursor-crosshair z-10' : '',
        selectable && !selected && !targetable ? 'border-transparent hover:border-white/40 hover:-translate-y-1 cursor-pointer' : '',
        !selectable && !targetable ? 'border-transparent cursor-default' : '',
        card.exhausted && !targetable ? 'opacity-60' : '',
        shaking ? 'animate-shake' : '',
      )}
      style={{
        boxShadow: selected
          ? `0 0 0 3px #7b2bff66, 0 12px 32px #7b2bff44`
          : targetable
          ? `0 0 0 2px #ff475766, 0 8px 24px #ff475744`
          : `0 4px 16px ${color}33`,
      }}
    >
      <div className="aspect-[0.714] relative" style={{ background: `linear-gradient(160deg,${color}25,#050310)` }}>
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover" unoptimized />
          : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">?</div>
        }
        {/* Top rarity line */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />
        {/* Exhausted overlay */}
        {card.exhausted && !targetable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
            <Shield size={20} className="text-white/30" />
          </div>
        )}
        {/* HP bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
          <div className="h-full transition-all duration-500 rounded-full"
            style={{ width: `${hpPct}%`, background: hpCol }} />
        </div>
      </div>
      {/* Stats */}
      <div className="flex items-center justify-between px-1.5 py-1" style={{ background: '#070512' }}>
        <span className="text-[11px] font-black" style={{ color: '#ff6b6b' }}>⚔{card.atk}</span>
        <span className="text-[11px] font-black" style={{ color: hpCol }}>♥{card.currentHp}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none w-32">
        <div className="bg-black/95 border border-white/20 rounded-xl px-3 py-2 text-center shadow-xl">
          <p className="text-white text-[11px] font-black">{card.name}</p>
          <p className="text-white/40 text-[9px] mt-0.5">{card.currentHp}/{card.hp} PV</p>
          {card.exhausted && <p className="text-white/30 text-[9px] mt-0.5">Épuisée</p>}
        </div>
        <div className="w-2 h-2 bg-black/95 rotate-45 border-b border-r border-white/20 -mt-1" />
      </div>
    </button>
  )
}

// ── Hero portrait ──────────────────────────────────────────────────────────
function HeroPortrait({
  hp, maxHp = 30, name, avatar, isTarget, onClick, popups
}: {
  hp: number; maxHp?: number; name?: string; avatar?: string | null
  isTarget?: boolean; onClick?: () => void; popups?: FloatPopup[]
}) {
  const pct = Math.max(0, (hp / maxHp) * 100)
  const col = pct > 50 ? '#00c896' : pct > 25 ? '#ff9a3d' : '#ff4757'
  return (
    <div className="flex flex-col items-center gap-1.5 relative">
      {popups?.map(p => <DmgFloat key={p.id} value={p.value} isHeal={p.isHeal} />)}
      <button
        onClick={onClick}
        className={cn(
          'relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-all duration-200 shadow-lg',
          isTarget ? 'border-[#ff4757] scale-110 cursor-crosshair shadow-[0_0_20px_#ff475766]' : 'border-white/20 cursor-default'
        )}
        style={{ background: 'linear-gradient(135deg,#1a0a3a,#0a0516)' }}
        disabled={!isTarget}
      >
        {avatar
          ? <Image src={avatar} alt={name ?? ''} fill className="object-cover" unoptimized />
          : <div className="w-full h-full flex items-center justify-center text-xl font-black text-white/40">{name?.[0]?.toUpperCase() ?? '?'}</div>
        }
        {isTarget && (
          <div className="absolute inset-0 bg-[#ff4757]/20 flex items-center justify-center">
            <span className="text-xl">⚔</span>
          </div>
        )}
      </button>
      {/* HP */}
      <div className="flex items-center gap-1">
        <span className="text-sm font-black" style={{ color: col }}>♥{hp}</span>
      </div>
      {/* HP bar */}
      <div className="w-14 sm:w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col }} />
      </div>
      <span className="text-[10px] text-white/40 font-bold truncate max-w-[64px] text-center">{name}</span>
    </div>
  )
}

// ── Mana gems ──────────────────────────────────────────────────────────────
function ManaGems({ mana, max }: { mana: number; max: number }) {
  const total = Math.min(max, 10)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap justify-center gap-1 w-10">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full border transition-all duration-300"
            style={{
              background: i < mana ? 'linear-gradient(135deg,#4aa3ff,#2563eb)' : 'transparent',
              borderColor: i < mana ? '#4aa3ff88' : '#ffffff15',
              boxShadow: i < mana ? '0 0 6px #4aa3ff66' : 'none',
            }} />
        ))}
      </div>
      <span className="text-[10px] font-black text-[#4aa3ff]">{mana}/{max}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function CombatArena({
  myHp, oppHp, myMana, myMaxMana,
  myBoard, oppBoard, myHand,
  myDeckCount = 0, oppHandCount = 0,
  myTurn, myName, oppName, myAvatar, oppAvatar,
  topLabel,
  onPlayCard, onAttack, onEndTurn, onSurrender,
  log = [], disabled = false,
}: CombatArenaProps) {
  const [selectedCard, setSelectedCard] = useState<ArenaCard | null>(null)
  const [shakingUids, setShakingUids]   = useState<Set<string>>(new Set())
  const [myFacePopups,  setMyFacePopups]  = useState<FloatPopup[]>([])
  const [oppFacePopups, setOppFacePopups] = useState<FloatPopup[]>([])
  const prevMyHp  = useRef(myHp)
  const prevOppHp = useRef(oppHp)

  const shake = useCallback((uid: string) => {
    setShakingUids(s => new Set([...s, uid]))
    setTimeout(() => setShakingUids(s => { const n = new Set(s); n.delete(uid); return n }), 450)
  }, [])

  const addFacePopup = useCallback((side: 'my' | 'opp', value: number) => {
    const popup: FloatPopup = { id: `${side}_${Date.now()}`, value }
    if (side === 'my')  setMyFacePopups(p  => [...p, popup])
    else                setOppFacePopups(p => [...p, popup])
    setTimeout(() => {
      if (side === 'my')  setMyFacePopups(p  => p.filter(x => x.id !== popup.id))
      else                setOppFacePopups(p => p.filter(x => x.id !== popup.id))
    }, 900)
  }, [])

  useEffect(() => {
    if (oppHp < prevOppHp.current) addFacePopup('opp', prevOppHp.current - oppHp)
    if (myHp  < prevMyHp.current)  addFacePopup('my',  prevMyHp.current  - myHp)
    prevOppHp.current = oppHp
    prevMyHp.current  = myHp
  }, [oppHp, myHp, addFacePopup])

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

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#09060f 0%,#0e0920 40%,#090618 100%)' }}>

      {/* ── Starfield bg ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Glowing center line */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg,transparent,#7b2bff33,#a855f755,#7b2bff33,transparent)' }} />
        {/* Void top glow */}
        <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 0%,#1a0a3a55,transparent)' }} />
        {/* Player bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%,#0a1a3a44,transparent)' }} />
      </div>

      {/* ── Top label ── */}
      {topLabel && (
        <div className="relative z-20 flex justify-center pt-2 pb-1 flex-shrink-0">
          {topLabel}
        </div>
      )}

      {/* ── OPPONENT SIDE ── */}
      <div className="relative z-10 flex items-center px-4 gap-4 flex-shrink-0 py-2">
        {/* Opponent hero */}
        <HeroPortrait hp={oppHp} name={oppName ?? 'Adversaire'} avatar={oppAvatar}
          isTarget={canAttackFace}
          onClick={() => canAttackFace && handleAttack(selectedCard!, 'face')}
          popups={oppFacePopups}
        />
        {/* Opponent hand (hidden) */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {Array.from({ length: Math.min(oppHandCount, 10) }).map((_, i) => (
            <div key={i} className="w-8 h-11 rounded-lg border border-white/[0.06] flex-shrink-0"
              style={{ background: 'linear-gradient(160deg,#1a0a3a,#070512)' }} />
          ))}
          {oppHandCount === 0 && <span className="text-white/10 text-xs">Main vide</span>}
        </div>
        {/* Deck count */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-14 rounded-xl border border-white/10 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg,#1a0a3a,#070512)' }}>
            <span className="text-white/50 text-xs font-black">{myDeckCount > 0 ? oppHandCount : 0}</span>
          </div>
          <span className="text-white/20 text-[9px]">deck</span>
        </div>
      </div>

      {/* ── OPPONENT BOARD ── */}
      <div className={cn(
        'relative z-10 flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 mx-4 rounded-2xl transition-all duration-200 flex-shrink-0 min-h-[100px]',
        selectedCard && !selectedCard.exhausted && oppBoard.length > 0
          ? 'bg-[#ff4757]/[0.06] border border-[#ff4757]/20'
          : 'bg-white/[0.02] border border-white/[0.04]'
      )}>
        {oppBoard.length === 0
          ? <span className={cn('text-xs font-bold transition-all', canAttackFace ? 'text-[#ff4757]/50 animate-pulse' : 'text-white/10')}>
              {canAttackFace ? '⚔ Attaquer le héros directement' : 'Plateau adverse vide'}
            </span>
          : oppBoard.map(c => (
            <BoardCard key={c.uid} card={c} selectable={false} selected={false}
              targetable={!!selectedCard && !selectedCard.exhausted}
              onClick={() => handleBoardClick(c, true)} shaking={shakingUids.has(c.uid)} />
          ))
        }
      </div>

      {/* ── BATTLEFIELD DIVIDER ── */}
      <div className="relative z-10 flex items-center justify-center py-1 flex-shrink-0">
        <div className="flex-1 h-px mx-8" style={{ background: 'linear-gradient(90deg,transparent,#7b2bff22,transparent)' }} />
        <Swords size={16} className="text-white/10 mx-2" />
        <div className="flex-1 h-px mx-8" style={{ background: 'linear-gradient(90deg,transparent,#7b2bff22,transparent)' }} />
      </div>

      {/* ── MY BOARD ── */}
      <div className={cn(
        'relative z-10 flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 mx-4 rounded-2xl transition-all duration-200 flex-shrink-0 min-h-[100px]',
        selectedCard ? 'bg-[#7b2bff]/[0.05] border border-[#7b2bff]/15' : 'bg-white/[0.02] border border-white/[0.04]'
      )}>
        {myBoard.length === 0
          ? <span className="text-white/10 text-xs font-bold">Pose une carte depuis ta main</span>
          : myBoard.map(c => (
            <BoardCard key={c.uid} card={c}
              selectable={myTurn && !disabled}
              selected={selectedCard?.uid === c.uid}
              targetable={false}
              onClick={() => handleBoardClick(c, false)}
              shaking={shakingUids.has(c.uid)} />
          ))
        }
      </div>

      {/* ── MY SIDE : hero + mana + end turn ── */}
      <div className="relative z-10 flex items-center px-4 gap-4 flex-shrink-0 py-2">
        <HeroPortrait hp={myHp} name={myName ?? 'Moi'} avatar={myAvatar} popups={myFacePopups} />
        <div className="flex-1 flex items-center justify-center">
          <ManaGems mana={myMana} max={myMaxMana} />
        </div>
        {/* Deck */}
        <div className="flex flex-col items-center gap-0.5 mr-2">
          <div className="w-10 h-14 rounded-xl border border-[#7b2bff]/20 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg,#150830,#070512)' }}>
            <span className="text-[#a78bfa]/70 text-xs font-black">{myDeckCount}</span>
          </div>
          <span className="text-white/20 text-[9px]">deck</span>
        </div>
        {/* End turn + surrender */}
        <div className="flex flex-col gap-2">
          <button onClick={onEndTurn} disabled={!myTurn || disabled}
            className={cn(
              'px-5 py-3 rounded-2xl text-sm font-black transition-all shadow-lg',
              myTurn && !disabled
                ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0] active:scale-95 shadow-[0_4px_20px_#7b2bff55]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            )}>
            {myTurn && !disabled ? 'Fin de tour' : 'Attente…'}
          </button>
          <button onClick={onSurrender}
            className="px-3 py-1.5 rounded-xl bg-red-900/20 text-red-400/70 text-xs font-bold hover:bg-red-900/40 hover:text-red-400 transition-colors flex items-center justify-center gap-1">
            <Flag size={11} /> Abandon
          </button>
        </div>
      </div>

      {/* ── HAND ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-end pb-3 flex-shrink-0">
        {selectedCard && (
          <p className="text-center text-[#a78bfa] text-[10px] font-bold animate-pulse mb-1">
            {selectedCard.name} sélectionnée — clique une cible ou une carte adverse
          </p>
        )}
        <div className="flex items-end justify-center gap-1.5 sm:gap-2 px-2 overflow-x-auto scrollbar-hide pb-1 pt-2">
          {myHand.length === 0
            ? <span className="text-white/10 text-xs py-4">Main vide</span>
            : myHand.map(card => (
              <HandCard key={card.uid} card={card}
                canPlay={myTurn && !disabled && card.cost <= myMana}
                onClick={() => { onPlayCard(card); setSelectedCard(null) }}
              />
            ))
          }
        </div>
      </div>

      {/* ── Log (floating bottom-left) ── */}
      {log.length > 0 && (
        <div className="absolute bottom-4 left-4 z-30 w-52 max-h-28 overflow-y-auto rounded-xl bg-black/60 border border-white/[0.05] p-2 scrollbar-hide">
          {log.map((l, i) => (
            <p key={i} className="text-white/30 text-[9px] leading-relaxed">{l}</p>
          ))}
        </div>
      )}
    </div>
  )
}

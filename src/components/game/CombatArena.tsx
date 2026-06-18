'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Flag, Zap, Heart, Shield, Swords, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}
const RARITY_GLOW: Record<string, string> = {
  void: '0 0 18px #a855f766', legendary: '0 0 18px #ff9a3d66',
  epic: '0 0 18px #ec489966', rare: '0 0 18px #4aa3ff55', common: 'none',
}

export interface ArenaCard {
  uid: string; id: string; name: string; rarity: string
  atk: number; hp: number; currentHp: number; cost: number
  exhausted: boolean; image_url?: string | null
}

interface DamagePopup {
  id: string; uid: string; value: number; x: number; y: number
}

interface Props {
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

// ── Mini card for hand ─────────────────────────────────────────────────────
function HandCard({ card, canPlay, onClick }: { card: ArenaCard; canPlay: boolean; onClick: () => void }) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  return (
    <button
      onClick={onClick}
      disabled={!canPlay}
      className={cn(
        'relative flex-shrink-0 w-[52px] rounded-xl overflow-hidden border-2 transition-all duration-200 group',
        canPlay ? 'border-transparent hover:border-[#7b2bff] hover:-translate-y-2 hover:scale-110 cursor-pointer' : 'border-transparent opacity-50 cursor-not-allowed'
      )}
      style={canPlay ? { boxShadow: RARITY_GLOW[card.rarity] } : undefined}
    >
      <div className="aspect-[0.714] relative" style={{ background: `linear-gradient(160deg,${color}22,#050310)` }}>
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover" unoptimized />
          : <div className="w-full h-full flex items-center justify-center text-white/10 text-[9px] font-bold uppercase">{card.name[0]}</div>
        }
        {/* Coût mana */}
        <div className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow"
          style={{ background: '#4aa3ffcc' }}>
          {card.cost}
        </div>
        {/* Stats */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 py-0.5 bg-black/60">
          <span className="text-[8px] font-black" style={{ color: '#ff6b6b' }}>{card.atk}</span>
          <span className="text-[8px] font-black" style={{ color: '#00c896' }}>{card.hp}</span>
        </div>
      </div>
      {/* Tooltip name */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-lg bg-black/90 text-white text-[9px] font-bold pointer-events-none border border-white/10">
        {card.name}
      </div>
    </button>
  )
}

// ── Board card ─────────────────────────────────────────────────────────────
function BoardCardUI({
  card, selectable, selected, targetable, onClick, damaged, healing
}: {
  card: ArenaCard; selectable: boolean; selected: boolean
  targetable: boolean; onClick: () => void
  damaged?: boolean; healing?: boolean
}) {
  const color = RARITY_COLOR[card.rarity] ?? '#9ca3af'
  const hpPct = Math.max(0, (card.currentHp / card.hp) * 100)
  const hpColor = hpPct > 60 ? '#00c896' : hpPct > 30 ? '#ff9a3d' : '#ff4757'

  return (
    <button onClick={onClick}
      className={cn(
        'relative w-[56px] rounded-xl overflow-hidden border-2 transition-all duration-200 group select-none',
        selected       ? 'border-[#7b2bff] scale-110 -translate-y-1' : '',
        targetable     ? 'border-[#ff4757]/80 hover:scale-110 hover:-translate-y-1 cursor-crosshair' : '',
        selectable && !selected && !targetable ? 'border-transparent hover:border-white/30 hover:-translate-y-1 cursor-pointer' : '',
        !selectable && !targetable ? 'border-transparent cursor-default' : '',
        card.exhausted && !targetable ? 'opacity-50' : '',
        damaged ? 'animate-shake' : '',
        healing ? 'animate-pulse' : '',
      )}
      style={{
        boxShadow: selected ? `0 0 20px #7b2bff88` : targetable ? `0 0 16px #ff475766` : RARITY_GLOW[card.rarity],
      }}
    >
      <div className="aspect-[0.714] relative" style={{ background: `linear-gradient(160deg,${color}22,#050310)` }}>
        {card.image_url
          ? <Image src={card.image_url} alt={card.name} fill className="object-cover" unoptimized />
          : <div className="w-full h-full flex items-center justify-center text-white/20 text-[9px] font-bold">{card.name[0]}</div>
        }
        {card.exhausted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Shield size={14} className="text-white/30" />
          </div>
        )}
        {/* HP bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
          <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
        </div>
      </div>
      {/* Stats */}
      <div className="flex justify-between px-1 py-0.5 bg-black/80">
        <span className="text-[8px] font-black" style={{ color: '#ff6b6b' }}>{card.atk}⚔</span>
        <span className="text-[8px] font-black" style={{ color: hpColor }}>{card.currentHp}</span>
      </div>
      {/* Name tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 whitespace-nowrap px-2 py-1 rounded-lg bg-black/90 text-white text-[9px] font-bold pointer-events-none border border-white/10">
        {card.name} · {card.atk}/{card.currentHp}
      </div>
    </button>
  )
}

// ── HP Bar ─────────────────────────────────────────────────────────────────
function HpBar({ hp, maxHp = 30, name, avatar, reverse }: { hp: number; maxHp?: number; name?: string; avatar?: string | null; reverse?: boolean }) {
  const pct = Math.max(0, (hp / maxHp) * 100)
  const color = pct > 50 ? '#00c896' : pct > 25 ? '#ff9a3d' : '#ff4757'
  return (
    <div className={cn('flex items-center gap-2', reverse && 'flex-row-reverse')}>
      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/10 flex-shrink-0 bg-[#1a0a3a]"
        style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover' } : {}}>
        {!avatar && <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-bold">{name?.[0]?.toUpperCase() ?? '?'}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('flex items-center justify-between text-[10px] mb-0.5', reverse && 'flex-row-reverse')}>
          <span className="text-white/50 font-bold truncate max-w-[80px]">{name ?? 'Joueur'}</span>
          <span className="font-black flex items-center gap-0.5" style={{ color }}>
            <Heart size={10} /> {hp}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}

// ── Mana crystals ──────────────────────────────────────────────────────────
function ManaCrystals({ mana, max }: { mana: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      <Zap size={11} className="text-[#4aa3ff]" />
      <span className="text-[#4aa3ff] text-xs font-black">{mana}</span>
      <span className="text-white/30 text-[10px]">/{max}</span>
      <div className="flex gap-0.5 ml-1">
        {Array.from({ length: Math.min(max, 10) }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
            style={{ background: i < mana ? '#4aa3ff' : '#ffffff15' }} />
        ))}
      </div>
    </div>
  )
}

// ── Main CombatArena ───────────────────────────────────────────────────────
export function CombatArena({
  myHp, oppHp, myMana, myMaxMana,
  myBoard, oppBoard, myHand,
  myDeckCount = 0, oppHandCount = 0, oppDeckCount = 0,
  myTurn, myName, oppName, myAvatar, oppAvatar,
  topLabel,
  onPlayCard, onAttack, onEndTurn, onSurrender,
  log = [], disabled = false,
}: Props) {
  const [selectedCard, setSelectedCard] = useState<ArenaCard | null>(null)
  const [damagedUids, setDamagedUids]   = useState<Set<string>>(new Set())
  const [popups, setPopups]             = useState<DamagePopup[]>([])
  const [showLog, setShowLog]           = useState(false)
  const boardRef                        = useRef<HTMLDivElement>(null)

  // Flash damage animation
  const flashDamage = useCallback((uid: string) => {
    setDamagedUids(s => new Set([...s, uid]))
    setTimeout(() => setDamagedUids(s => { const n = new Set(s); n.delete(uid); return n }), 400)
  }, [])

  // Damage popup
  const showDamagePopup = useCallback((uid: string, value: number) => {
    const id = `${uid}_${Date.now()}`
    setPopups(p => [...p, { id, uid, value, x: Math.random() * 20 - 10, y: 0 }])
    setTimeout(() => setPopups(p => p.filter(pp => pp.id !== id)), 900)
  }, [])

  // Watch HP changes for animations (rough approach)
  const prevOppHp = useRef(oppHp)
  const prevMyHp  = useRef(myHp)
  useEffect(() => {
    if (oppHp < prevOppHp.current) showDamagePopup('opp_face', prevOppHp.current - oppHp)
    if (myHp  < prevMyHp.current)  showDamagePopup('my_face',  prevMyHp.current  - myHp)
    prevOppHp.current = oppHp
    prevMyHp.current  = myHp
  }, [oppHp, myHp, showDamagePopup])

  function handleAttack(attacker: ArenaCard, target: ArenaCard | 'face') {
    if (target !== 'face') flashDamage(target.uid)
    flashDamage(attacker.uid)
    onAttack(attacker, target)
    setSelectedCard(null)
  }

  function handleBoardClick(card: ArenaCard, isOpp: boolean) {
    if (disabled || !myTurn) return
    if (isOpp) {
      if (selectedCard && !selectedCard.exhausted) handleAttack(selectedCard, card)
      return
    }
    if (!card.exhausted) {
      setSelectedCard(s => s?.uid === card.uid ? null : card)
    }
  }

  const canAttackFace = selectedCard && !selectedCard.exhausted && oppBoard.length === 0

  return (
    <div className="flex flex-col min-h-screen bg-[#030308] relative overflow-hidden select-none">

      {/* Background void gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, #1a0a3a44, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 100%, #0a1a3a33, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-[60%] bg-gradient-to-b from-transparent via-white/[0.04] to-transparent" />
      </div>

      {/* Top label (mode indicator) */}
      {topLabel && (
        <div className="relative z-10 flex justify-center pt-2">
          {topLabel}
        </div>
      )}

      {/* ── Opponent zone ── */}
      <div className="relative z-10 px-3 pt-2 pb-1">
        <div className="flex items-center justify-between mb-2">
          <HpBar hp={oppHp} name={oppName ?? 'Adversaire'} avatar={oppAvatar} />
          <div className="flex items-center gap-2 text-white/30 text-[10px]">
            <span>{oppHandCount} 🂠</span>
            <span>{oppDeckCount} deck</span>
          </div>
        </div>

        {/* Opp board */}
        <div
          className={cn(
            'flex gap-2 justify-center items-end min-h-[90px] py-2 px-3 rounded-2xl transition-all duration-200',
            selectedCard && !selectedCard.exhausted && oppBoard.length > 0
              ? 'bg-[#ff4757]/[0.06] border border-[#ff4757]/20'
              : 'bg-white/[0.02] border border-white/[0.04]'
          )}
          ref={boardRef}
        >
          {oppBoard.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center w-full h-[74px] rounded-xl text-xs font-bold transition-all',
                canAttackFace ? 'text-[#ff4757]/70 cursor-crosshair border border-dashed border-[#ff4757]/30 bg-[#ff4757]/5 hover:bg-[#ff4757]/10' : 'text-white/10'
              )}
              onClick={() => canAttackFace && handleAttack(selectedCard!, 'face')}
            >
              {canAttackFace ? '⚔ Attaquer directement' : 'Plateau vide'}
            </div>
          ) : (
            <>
              {oppBoard.map(card => (
                <div key={card.uid} className="relative">
                  <BoardCardUI
                    card={card}
                    selectable={false}
                    selected={false}
                    targetable={!!selectedCard && !selectedCard.exhausted}
                    onClick={() => handleBoardClick(card, true)}
                    damaged={damagedUids.has(card.uid)}
                  />
                  {popups.filter(p => p.uid === card.uid).map(p => (
                    <DamageFloat key={p.id} value={p.value} x={p.x} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Divider center ── */}
      <div className="relative z-10 flex items-center justify-center py-1">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <div className="mx-3 flex items-center gap-2">
          <Swords size={14} className="text-white/20" />
          {!myTurn && !disabled && (
            <span className="text-[10px] text-[#a78bfa] animate-pulse font-bold">Tour adversaire…</span>
          )}
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ── My board ── */}
      <div className="relative z-10 px-3 pb-1">
        <div
          className={cn(
            'flex gap-2 justify-center items-end min-h-[90px] py-2 px-3 rounded-2xl transition-all duration-200',
            selectedCard ? 'bg-[#7b2bff]/[0.05] border border-[#7b2bff]/15' : 'bg-white/[0.02] border border-white/[0.04]'
          )}
        >
          {myBoard.length === 0 ? (
            <span className="text-white/10 text-xs w-full text-center self-center h-[74px] flex items-center justify-center">
              Pose une carte depuis ta main
            </span>
          ) : (
            myBoard.map(card => (
              <div key={card.uid} className="relative">
                <BoardCardUI
                  card={card}
                  selectable={myTurn && !disabled}
                  selected={selectedCard?.uid === card.uid}
                  targetable={false}
                  onClick={() => handleBoardClick(card, false)}
                  damaged={damagedUids.has(card.uid)}
                />
                {popups.filter(p => p.uid === card.uid).map(p => (
                  <DamageFloat key={p.id} value={p.value} x={p.x} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── My stats + actions ── */}
      <div className="relative z-10 px-3 pb-1">
        <div className="flex items-center justify-between">
          <HpBar hp={myHp} name={myName ?? 'Moi'} avatar={myAvatar} />
          <div className="flex items-center gap-2">
            <ManaCrystals mana={myMana} max={myMaxMana} />
            <button
              onClick={onEndTurn}
              disabled={!myTurn || disabled}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all',
                myTurn && !disabled
                  ? 'bg-[#7b2bff] text-white hover:bg-[#6920e0] shadow-lg shadow-[#7b2bff]/30 active:scale-95'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}>
              {myTurn ? 'Fin de tour' : 'Attente…'}
            </button>
            <button
              onClick={onSurrender}
              className="w-8 h-8 rounded-xl bg-red-900/20 text-red-400 flex items-center justify-center hover:bg-red-900/40 transition-colors">
              <Flag size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="relative z-10 px-3 pb-2 flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-white/30 text-[10px]">Main ({myHand.length}) · Deck {myDeckCount}</span>
          {selectedCard && (
            <span className="text-[#a78bfa] text-[10px] ml-auto animate-pulse">Sélectionné : {selectedCard.name}</span>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide justify-center flex-wrap">
          {myHand.length === 0 ? (
            <span className="text-white/15 text-xs py-4">Main vide</span>
          ) : myHand.map(card => (
            <HandCard key={card.uid} card={card}
              canPlay={myTurn && !disabled && card.cost <= myMana}
              onClick={() => { onPlayCard(card); setSelectedCard(null) }}
            />
          ))}
        </div>
      </div>

      {/* ── Log toggle ── */}
      {log.length > 0 && (
        <div className="relative z-10 px-3 pb-3">
          <button onClick={() => setShowLog(v => !v)}
            className="flex items-center gap-1 text-white/20 text-[10px] hover:text-white/40 transition-colors">
            {showLog ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            Journal
          </button>
          {showLog && (
            <div className="mt-1 rounded-xl bg-black/30 border border-white/[0.04] p-2 max-h-28 overflow-y-auto">
              {log.map((l, i) => (
                <p key={i} className="text-white/30 text-[10px] leading-relaxed">{l}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Damage popups on faces */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {popups.filter(p => p.uid === 'opp_face').map(p => (
          <div key={p.id} className="absolute top-[18%] left-1/2 -translate-x-1/2">
            <DamageFloat value={p.value} x={p.x} large />
          </div>
        ))}
        {popups.filter(p => p.uid === 'my_face').map(p => (
          <div key={p.id} className="absolute bottom-[30%] left-1/2 -translate-x-1/2">
            <DamageFloat value={p.value} x={p.x} large />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Damage float animation ─────────────────────────────────────────────────
function DamageFloat({ value, x, large }: { value: number; x: number; large?: boolean }) {
  return (
    <div
      className={cn('absolute font-black text-[#ff4757] pointer-events-none animate-damage-float', large ? 'text-2xl' : 'text-sm')}
      style={{ left: `calc(50% + ${x}px)`, top: 0, textShadow: '0 0 12px #ff4757' }}
    >
      -{value}
    </div>
  )
}

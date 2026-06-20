'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Zap } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { CardMedia } from '@/components/game/CardMedia'
import { CardBackDisplay } from '@/components/game/CardBackDisplay'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { useAchievements } from '@/hooks/useAchievements'
import { trackMissionProgress } from '@/lib/game/mission-tracker'

interface Card {
  id: string
  name: string
  rarity: string
  family?: string
  artUrl?: string
  description?: string | null
  artist?: string | null
  artistUrl?: string | null
}

interface Props {
  cards: Card[]
  boosterImageUrl?: string
  boosterType?: string
  onClose: () => void
  onOpenAnother?: () => void
  canOpenAnother?: boolean
  onCancel?: () => void
  creditId?: number | string | null
}

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}
const RARITY_BG: Record<string, string> = {
  void:      'radial-gradient(ellipse at 50% 0%, #1a0a3a 0%, #050210 60%, #000 100%)',
  legendary: 'radial-gradient(ellipse at 50% 0%, #2a1800 0%, #100800 60%, #000 100%)',
  epic:      'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0a0518 60%, #000 100%)',
  rare:      'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #040810 60%, #000 100%)',
  common:    'radial-gradient(ellipse at 50% 0%, #111118 0%, #060608 60%, #000 100%)',
}
const SUSPENSE_MS: Record<string, number> = {
  void: 2800, legendary: 2800, epic: 1500, rare: 1000, common: 420,
}
const PARTICLE_COUNT: Record<string, number> = {
  void: 60, legendary: 45, epic: 28, rare: 18, common: 0,
}
const TEAR_Y = 14

function hexToRgba(hex: string, a: number) {
  const v = hex.replace('#','')
  const b = parseInt(v.length===3?v.split('').map(c=>c+c).join(''):v,16)
  return `rgba(${(b>>16)&255},${(b>>8)&255},${b&255},${a})`
}

interface Particle { id:number; x:number; y:number; color:string; size:number; delay:number; dur:number; vx:number; vy:number }

type Phase = 'idle'|'tearing'|'torn'|'cards'|'results'
type CardPhase = 'back'|'suspense'|'revealed'|'hiding'

// ── Écran de résultats ────────────────────────────────────────────────────────
function ResultsScreen({ cards, boosterType = 'void', newCardIds, onClose, onOpenAnother, canOpenAnother, creditId }: { cards: Card[]; boosterType?: string; newCardIds: Set<string>; onClose: () => void; onOpenAnother?: () => void; canOpenAnother?: boolean; creditId?: number | string | null }) {
  const { user, profile, setProfile } = useGameStore(s => ({ user: s.user, profile: s.profile, setProfile: s.setProfile }))
  const { checkAfterPackOpen } = useAchievements()
  const [selected, setSelected] = useState<Card | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [xpGain, setXpGain]     = useState(0)
  const [levelUp, setLevelUp]   = useState<number | null>(null)
  const [showXP, setShowXP]     = useState(false)
  const [lvlParticles, setLvlParticles] = useState<{id:number;x:number;y:number;c:string;s:number;d:number}[]>([])

  const XP_PER_RARITY: Record<string, number> = {
    void: 500, legendary: 300, epic: 150, rare: 80, common: 10,
  }

  async function handleSave() {
    if (!user || saving || saved) return
    setSaving(true)
    try {
      // Claim le booster maintenant (annuler avant cette étape ne retire rien)
      let packsOpenedTotal = 1
      if (creditId) {
        const claimRes = await fetch('/api/booster/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(creditId) }),
        })
        if (!claimRes.ok) throw new Error('claim error')
        const claimData = await claimRes.json()
        packsOpenedTotal = claimData.packs_opened ?? 1
      }

      // Track missions
      if (user) {
        const RARITY_RANK: Record<string, number> = { void: 4, legendary: 3, epic: 2, rare: 1, common: 0 }
        const bestRank = cards.reduce((max, c) => Math.max(max, RARITY_RANK[c.rarity] ?? 0), 0)
        trackMissionProgress(user.id, 'collect_5', cards.length)
        if (bestRank >= 1) trackMissionProgress(user.id, 'get_rare', 1)
        if (bestRank >= 2) trackMissionProgress(user.id, 'get_epic', 1)
      }

      // Save cards
      await fetch('/api/collection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cards.map(c => ({
          cardId: c.id, rarity: c.rarity, family: c.family ?? 'void',
          metadata: JSON.stringify({ name: c.name, image_url: c.artUrl ?? null, source: 'pack' }),
        }))),
      })

      const totalXP = cards.reduce((sum, c) => sum + (XP_PER_RARITY[c.rarity] ?? 10), 0)
      setXpGain(totalXP)

      // Update XP
      const xpRes = await fetch('/api/profile/xp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xp: totalXP }),
      })
      const updated = xpRes.ok ? await xpRes.json() : null

      if (updated && profile && updated.level > (profile.level ?? 1)) {
        setLevelUp(updated.level)
        const colors = ['#a855f7','#c084fc','#7b2bff','#e879f9','#ffffff','#d8b4fe']
        setLvlParticles(Array.from({ length: 40 }, (_, i) => ({
          id: i, x: 30+Math.random()*40, y: 30+Math.random()*40,
          c: colors[Math.floor(Math.random()*colors.length)],
          s: 4+Math.random()*8, d: 0.6+Math.random()*1.2,
        })))
        setTimeout(() => { setLvlParticles([]); setLevelUp(null) }, 3000)
      }
      if (updated) setProfile({ ...profile!, ...updated })

      // Achievements
      const allCards = await fetch('/api/collection').then(r => r.ok ? r.json() : [])
      const uniqueCount = new Set(allCards.map((c: { card_id?: string; cardId?: string }) => c.card_id ?? c.cardId)).size
      await checkAfterPackOpen(cards, packsOpenedTotal, uniqueCount, boosterType)

      setSaved(true); setShowXP(true)
      setTimeout(() => setShowXP(false), 2500)
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const bestRarity = cards.reduce((best, c) => {
    const order = ['void','legendary','epic','rare','common']
    return order.indexOf(c.rarity) < order.indexOf(best) ? c.rarity : best
  }, 'common')

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: RARITY_BG[bestRarity] ?? RARITY_BG.common }}>

      {/* Level up */}
      {levelUp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute w-[600px] h-[600px] rounded-full animate-[lvlRing1_.8s_ease-out_forwards]"
            style={{ border:'3px solid rgba(168,85,247,.6)', boxShadow:'0 0 40px rgba(168,85,247,.4)' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full animate-[lvlRing2_.8s_ease-out_.1s_forwards]"
            style={{ border:'2px solid rgba(192,132,252,.5)' }} />
          <div className="absolute w-[240px] h-[240px] rounded-full animate-[lvlBurstGlow_1s_ease-out_forwards]"
            style={{ background:'radial-gradient(circle,rgba(123,43,255,.8) 0%,rgba(168,85,247,.4) 40%,transparent 70%)' }} />
          {lvlParticles.map(p => (
            <div key={p.id} className="absolute rounded-full"
              style={{ width:p.s, height:p.s, background:p.c,
                left:`${p.x}%`, top:`${p.y}%`,
                boxShadow:`0 0 ${p.s*2}px ${p.c}`,
                animation:`lvlParticle ${p.d}s ease-out forwards`,
                '--tx':`${(Math.random()-.5)*300}px`,
                '--ty':`${-100-Math.random()*200}px`,
              } as React.CSSProperties} />
          ))}
          <div className="flex flex-col items-center gap-2 animate-[lvlText_2.5s_ease-out_forwards] relative z-10">
            <p className="text-5xl font-black text-white tracking-tight"
              style={{ textShadow:'0 0 60px #a855f7,0 0 120px #7b2bff' }}>
              NIVEAU {levelUp}
            </p>
            <p className="text-[#c084fc] text-lg font-bold tracking-widest uppercase">Level Up</p>
          </div>
        </div>
      )}

      {/* XP */}
      {showXP && (
        <div className="fixed top-16 left-1/2 z-[200] pointer-events-none" style={{ transform:'translateX(-50%)' }}>
          <div className="px-4 py-2 rounded-full text-white font-bold text-sm animate-[xpFloat_2.5s_ease-out_forwards]"
            style={{ background:'linear-gradient(135deg,#7b2bff,#a855f7)', boxShadow:'0 0 20px rgba(123,43,255,.6)' }}>
            +{xpGain} XP
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-white font-black text-base">Cartes obtenues</h2>
          <p className="text-white/40 text-xs">{cards.length} cartes · Clique pour inspecter</p>
        </div>
        {!saved ? (
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50"
            style={{ background:'linear-gradient(135deg,#7b2bff,#4a1fa8)', boxShadow:'0 0 20px rgba(123,43,255,.4)' }}>
            {saving ? '…' : '+ Collection'}
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {canOpenAnother && onOpenAnother && (
              <button onClick={onOpenAnother}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold shrink-0"
                style={{ background:'linear-gradient(135deg,#7b2bff,#4a1fa8)', boxShadow:'0 0 20px rgba(123,43,255,.4)' }}>
                Ouvrir un nouveau pack
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-bold shrink-0">
              Terminer
            </button>
          </div>
        )}
      </div>

      {/* Grille petites cartes */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-hidden">
        <div className="flex flex-wrap gap-4 justify-center max-w-2xl">
          {cards.map((card, i) => {
            const isNew = newCardIds.has(card.id)
            return (
              <div key={i} onClick={() => setSelected(card)}
                className="relative active:scale-95 transition-transform flex-shrink-0 cursor-pointer"
                style={{
                  width: 'clamp(120px, 18vw, 200px)',
                  height: 'clamp(168px, 25vw, 280px)',
                  borderRadius: 12,
                  boxShadow: isNew
                    ? '0 0 18px 5px rgba(251,191,36,.6), 0 0 40px 10px rgba(245,158,11,.3)'
                    : `0 0 14px ${hexToRgba(RARITY_COLOR[card.rarity]??'#7b2bff',.4)}`,
                  animation: isNew
                    ? `cardFadeIn .4s ease-out ${i*.07}s both, newCardGlow 1.6s ease-in-out ${0.4 + i*.07}s 3`
                    : `cardFadeIn .4s ease-out ${i*.07}s both`,
                }}>
                <CardFrame rarity={card.rarity} name={card.name} style={{ position:'absolute', inset:0 }}>
                  {card.artUrl
                    ? <CardMedia src={card.artUrl} alt={card.name} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src="/assets/dos.png" alt={card.name} className="absolute inset-0 w-full h-full object-cover" />
                  }
                </CardFrame>

                {/* Badge NOUVEAU */}
                {isNew && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    {/* Shine sweep */}
                    <div className="absolute inset-y-0 w-1/3"
                      style={{
                        background:'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)',
                        animation:'newCardShine 1.2s ease-in-out 0.3s 2 both',
                        zIndex: 10,
                      }} />
                  </div>
                )}
                {isNew && (
                  <div className="absolute -top-2 left-1/2 z-20 whitespace-nowrap font-black text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{
                      transform:'translateX(-50%)',
                      background:'linear-gradient(90deg,#b45309,#f59e0b)',
                      color:'#fff',
                      boxShadow:'0 0 10px rgba(251,191,36,.8)',
                      textShadow:'0 1px 2px rgba(0,0,0,.4)',
                      animation:'newCardPop .5s ease-out both',
                      animationDelay:`${0.2 + i * 0.06}s`,
                    }}>
                    ✦ Nouveau
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal inspection */}
      {selected && (
        <CardModal
          name={selected.name}
          rarity={selected.rarity}
          family={selected.family}
          artUrl={selected.artUrl}
          description={selected.description}
          artist={selected.artist}
          artistUrl={selected.artistUrl}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
const DEFAULT_CARD_BACK = {
  gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
  pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
  imageUrl: null as string | null,
}

export function BoosterOpening({ cards, boosterImageUrl, boosterType = 'void', onClose, onOpenAnother, canOpenAnother, onCancel, creditId }: Props) {
  const profile = useGameStore(s => s.profile)
  const setProfileStore = useGameStore(s => s.setProfile)
  const [cardBack, setCardBack] = useState(DEFAULT_CARD_BACK)
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const id = profile?.selected_card_back ?? 'default'
    fetch(`/api/card-backs?id=${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCardBack({ gradient: data.gradient ?? null, pattern: data.pattern ?? null, imageUrl: data.imageUrl ?? data.image_url ?? null }) })
  }, [profile?.selected_card_back])

  // Snapshot collection before opening to detect new cards during reveal
  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.ok ? r.json() : [])
      .then((existing: { card_id?: string; cardId?: string }[]) => {
        const existingIds = new Set(existing.map(c => c.card_id ?? c.cardId ?? ''))
        setNewCardIds(new Set(cards.filter(c => !existingIds.has(c.id)).map(c => c.id)))
      })
  }, []) // eslint-disable-line
  const [phase, setPhase]           = useState<Phase>('idle')
  const [cardIndex, setCardIndex]   = useState(0)
  const [cardPhase, setCardPhase]   = useState<CardPhase>('back')
  const [revealedColor, setRevealedColor] = useState('')
  const [bgStyle, setBgStyle]       = useState('radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)')
  const [auraColor, setAuraColor]   = useState('')
  const [raysColor, setRaysColor]   = useState('')
  const [particles, setParticles]   = useState<Particle[]>([])
  const [shake, setShake]           = useState(false)
  const [autoReveal, setAutoReveal] = useState(false)
  // Persisté en BDD (player_profiles.auto_reveal), synchronisé via le profil du store
  useEffect(() => { setAutoReveal(!!profile?.auto_reveal) }, [profile?.auto_reveal])
  async function toggleAuto() {
    const next = !autoReveal
    setAutoReveal(next)
    if (profile) setProfileStore({ ...profile, auto_reveal: next })
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoReveal: next }),
    }).catch(() => {})
  }

  const timerRefs    = useRef<ReturnType<typeof setTimeout>[]>([])
  const locked       = useRef(false)
  const tearCanvasRef = useRef<HTMLCanvasElement>(null)
  const tearRafRef   = useRef<number>(0)

  const currentCard = cards[cardIndex]
  const isLast      = cardIndex === cards.length - 1
  const rarity      = currentCard?.rarity ?? 'common'
  const packSrc     = boosterImageUrl || '/assets/dos.png'

  function later(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms); timerRefs.current.push(t); return t
  }
  function clearTimers() {
    timerRefs.current.forEach(clearTimeout); timerRefs.current = []; locked.current = false
  }
  useEffect(() => () => { clearTimers(); cancelAnimationFrame(tearRafRef.current) }, []) // eslint-disable-line

  function spawnTearParticles() {
    const canvas = tearCanvasRef.current
    if (!canvas) return
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width  = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    const colors = ['#ffffff','#a78bfa','#7b2bff','#c4b5fd','#e0d7ff']
    // Centre horizontal de l'écran, à ~TEAR_Y% depuis le haut du pack
    // Le pack fait ~min(72vw,300px) de large, centré
    const packW = Math.min(W * 0.72, 300)
    const packH = packW / 0.68 // ratio du pack
    const packTop = (H - packH) / 2 // pack verticalement centré
    const tearY = packTop + packH * (TEAR_Y / 100)
    const cx = W / 2

    const pts = Array.from({ length: 32 }, () => ({
      x: cx + (Math.random() - .5) * packW * .8,
      y: tearY + (Math.random() - .5) * 8,
      vx: (Math.random() - .5) * 8,
      vy: -2.5 - Math.random() * 5,
      r: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: .015 + Math.random() * .02,
    }))

    cancelAnimationFrame(tearRafRef.current)
    function frame() {
      ctx.clearRect(0, 0, W, H)
      let alive = false
      for (const p of pts) {
        p.life -= p.decay
        if (p.life <= 0) continue
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += .15
        const r = Math.max(0, p.r * p.life)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life
        ctx.shadowBlur = r * 3
        ctx.shadowColor = p.color
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
      }
      if (alive) tearRafRef.current = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, W, H)
    }
    tearRafRef.current = requestAnimationFrame(frame)
  }

  function spawnRevealParticles(c: string, count: number) {
    if (count <= 0) return
    const extras = rarity==='void' ? ['#ff80d5','#80e8ff','#c080ff','#fff'] :
                   rarity==='legendary' ? ['#ffcc80','#fff','#ffd700'] : [c,'#fff']
    setParticles(Array.from({ length: count }, (_, i) => ({
      id: Date.now()+i, x: 5+Math.random()*90, y: 10+Math.random()*80,
      color: extras[Math.floor(Math.random()*extras.length)],
      size: 3+Math.random()*5, delay: Math.random()*.4,
      dur: .9+Math.random()*.8, vx: (Math.random()-.5)*40, vy: -30-Math.random()*60,
    })))
    later(() => setParticles([]), 2000)
  }

  function setRevealFx(r: string, c: string) {
    const gA = r==='void'?.50:r==='legendary'?.40:r==='epic'?.30:r==='rare'?.20:.12
    const rA = r==='void'?.28:r==='legendary'?.22:r==='epic'?.16:r==='rare'?.10:.05
    setAuraColor(`radial-gradient(circle at center,${hexToRgba(c,gA)} 0%,${hexToRgba(c,gA*.3)} 30%,transparent 65%)`)
    setRaysColor(`conic-gradient(from 0deg,transparent 0deg,${hexToRgba(c,rA)} 18deg,transparent 40deg,transparent 84deg,${hexToRgba(c,rA*.8)} 106deg,transparent 136deg,transparent 178deg,${hexToRgba(c,rA)} 206deg,transparent 234deg,transparent 292deg,${hexToRgba(c,rA*.7)} 322deg,transparent 360deg)`)
  }

  const handleTear = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('tearing'); spawnTearParticles()
    setTimeout(() => setPhase('torn'), 80)
    setTimeout(() => { setPhase('cards'); setCardPhase('back'); locked.current = false }, 800)
  }, [phase]) // eslint-disable-line

  const handleCardTap = useCallback(() => {
    if (locked.current) return
    if (cardPhase === 'back') {
      locked.current = true; setCardPhase('suspense')
      const suspenseMs = SUSPENSE_MS[rarity] ?? 580
      if (rarity==='legendary'||rarity==='void') {
        later(() => { setShake(true); setTimeout(() => setShake(false), 400) }, suspenseMs*.6)
      }
      later(() => {
        const c = RARITY_COLOR[rarity] ?? '#9ca3af'
        setRevealedColor(c); setBgStyle(RARITY_BG[rarity])
        setRevealFx(rarity, c); setCardPhase('revealed')
        spawnRevealParticles(c, PARTICLE_COUNT[rarity] ?? 0)
        locked.current = false
      }, suspenseMs)
    } else if (cardPhase === 'revealed') {
      clearTimers(); setAuraColor(''); setRaysColor(''); setParticles([])
      setRevealedColor('')
      if (!isLast) {
        setBgStyle('radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)')
        locked.current = true
        setCardPhase('hiding')
        // Attendre la fin du flip retour (950ms) avant de changer de carte
        later(() => {
          setCardIndex(i => i + 1)
          setCardPhase('back')
          locked.current = false
        }, 960)
      } else { setPhase('results') }
    }
  }, [cardPhase, rarity, isLast]) // eslint-disable-line

  // Révélation automatique : enchaîne les taps tout en gardant les animations
  useEffect(() => {
    if (!autoReveal || phase !== 'cards' || locked.current) return
    if (cardPhase === 'back') {
      const t = setTimeout(() => handleCardTap(), 480)
      return () => clearTimeout(t)
    }
    if (cardPhase === 'revealed') {
      const hold = (rarity === 'void' || rarity === 'legendary') ? 1800 : rarity === 'epic' ? 1300 : 1000
      const t = setTimeout(() => handleCardTap(), hold)
      return () => clearTimeout(t)
    }
  }, [autoReveal, phase, cardPhase, cardIndex, rarity, handleCardTap])

  if (phase === 'results') return <ResultsScreen cards={cards} boosterType={boosterType ?? 'void'} newCardIds={newCardIds} onClose={onClose} onOpenAnother={onOpenAnother} canOpenAnother={canOpenAnother} creditId={creditId} />

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700', shake && 'animate-[screenShake_.4s_ease-in-out]')}
      style={{ background: bgStyle }}
    >
      {phase === 'idle' && onCancel && (
        <button
          onClick={e => { e.stopPropagation(); onCancel() }}
          className="absolute top-4 right-4 z-[120] w-9 h-9 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400/70 hover:text-red-300 hover:bg-red-900/40 hover:border-red-800/50 transition-colors"
          aria-label="Annuler l'ouverture"
        >
          ✕
        </button>
      )}

      {/* ── IDLE / TEARING ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div onClick={handleTear} className="relative flex flex-col items-center gap-8 cursor-pointer select-none">
          {/* Canvas particules déchirure — plein écran pour que les particules volent librement */}
          <canvas ref={tearCanvasRef} className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 110, width: '100vw', height: '100vh' }} />

          <div style={{
            width: 'min(72vw,300px)',
            filter: phase==='tearing'
              ? 'drop-shadow(0 0 50px rgba(255,255,255,.4)) drop-shadow(0 0 30px rgba(123,43,255,.8))'
              : 'drop-shadow(0 0 35px rgba(123,43,255,.6)) drop-shadow(0 0 70px rgba(123,43,255,.25))',
            animation: 'boosterFloat 3s ease-in-out infinite',
            transform: phase==='tearing'?'scale(1.04)':'scale(1)',
            transition: 'transform .15s,filter .15s',
            position: 'relative',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="Booster" className="w-full h-auto block" draggable={false} />
            <div className={cn('absolute inset-x-0 h-px pointer-events-none transition-opacity', phase==='tearing'?'opacity-100':'opacity-0')}
              style={{ top:`${TEAR_Y}%`, background:'white', boxShadow:'0 0 12px 4px rgba(255,255,255,.8)' }} />
          </div>
          <p className="text-white/50 text-sm animate-pulse">Clique pour ouvrir</p>

          <button onClick={e => { e.stopPropagation(); toggleAuto() }}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer',
              autoReveal
                ? 'bg-[#7b2bff]/25 border-[#7b2bff]/50 text-[#c4b5fd]'
                : 'bg-white/5 border-white/15 text-white/50 hover:text-white/80')}>
            <Zap size={14} className={autoReveal ? 'text-[#a855f7]' : ''} />
            Révélation auto · {autoReveal ? 'ON' : 'OFF'}
          </button>

        </div>
      )}

      {/* ── TORN ── */}
      {phase === 'torn' && (
        <div className="relative" style={{ width:'min(72vw,300px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packSrc} alt="" className="w-full h-auto invisible block" draggable={false} />
          <div className="absolute inset-x-0 top-0 overflow-hidden"
            style={{ height:`${TEAR_Y}%`, animation:'splitTopSmall .7s cubic-bezier(.25,.46,.45,.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block absolute top-0 left-0" draggable={false} />
          </div>
          <div className="absolute inset-x-0 overflow-hidden"
            style={{ top:`${TEAR_Y}%`, height:`${100-TEAR_Y}%`, animation:'splitBottomBig .7s cubic-bezier(.25,.46,.45,.94) forwards' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={packSrc} alt="" className="w-full block absolute left-0"
              style={{ top:`-${(TEAR_Y/(100-TEAR_Y))*100}%` }} draggable={false} />
          </div>
          <div className="absolute inset-x-0 bg-white pointer-events-none"
            style={{ top:`${TEAR_Y}%`, height:'2px', transform:'translateY(-50%)',
              boxShadow:'0 0 20px 10px rgba(255,255,255,.9)', animation:'flashLine .7s ease-out forwards' }} />
        </div>
      )}

      {/* ── CARDS ── */}
      {phase === 'cards' && currentCard && (
        <div className="flex flex-col items-center gap-5 relative">
          {/* Indicateurs */}
          <div className="flex items-center gap-1.5 z-10">
            {cards.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: i===cardIndex?'20px':'8px', height:'8px',
                  background: i < cardIndex ? 'rgba(255,255,255,0.5)'
                    : i===cardIndex && cardPhase==='revealed' ? (RARITY_COLOR[cards[i].rarity]??'#fff')
                    : 'rgba(255,255,255,0.2)',
                }} />
            ))}
          </div>

          {/* FX zone */}
          <div className="relative" style={{ width:'min(68vw,260px)', aspectRatio:'0.714' }}>
            <div className="absolute pointer-events-none z-0" style={{ inset:'-35%' }}>
              {auraColor && cardPhase==='revealed' && (
                <div style={{ position:'absolute', left:'50%', top:'50%', width:'640px', height:'640px',
                  transform:'translate(-50%,-50%)', background:auraColor, borderRadius:'50%',
                  filter:'blur(52px)', animation:'fxAura 1.4s ease-out forwards' }} />
              )}
              {raysColor && cardPhase==='revealed' && (
                <div style={{ position:'absolute', left:'50%', top:'50%', width:'780px', height:'780px',
                  transform:'translate(-50%,-50%)', background:raysColor, borderRadius:'50%',
                  mixBlendMode:'screen',
                  animation: rarity==='void'?'fxRaysMythic 2.0s ease-out forwards':'fxRays 1.6s ease-out forwards' }} />
              )}
              {revealedColor && cardPhase==='revealed' && (
                <div style={{ position:'absolute', left:'50%', top:'50%', width:'560px', height:'560px',
                  transform:'translate(-50%,-50%)',
                  background:`radial-gradient(circle at center,${hexToRgba(revealedColor,.5)},${hexToRgba(revealedColor,.15)} 34%,transparent 60%)`,
                  borderRadius:'50%', mixBlendMode:'screen',
                  animation: rarity==='void'?'fxBurstMythic 1.1s ease-out forwards':'fxBurst .9s ease-out forwards' }} />
              )}
              {particles.map(p => (
                <div key={p.id} className="absolute rounded-full pointer-events-none"
                  style={{ width:`${p.size}px`, height:`${p.size}px`, background:p.color,
                    left:`${p.x}%`, top:`${p.y}%`,
                    boxShadow:`0 0 ${p.size*2}px ${p.color}`,
                    animation:`fxParticleRise ${p.dur}s ease-out ${p.delay}s forwards` }} />
              ))}
            </div>

            {/* Carte flip */}
            <div onClick={handleCardTap} className="absolute inset-0 cursor-pointer select-none z-10"
              style={{ perspective:'1000px' }}>
              <div className="w-full h-full relative transition-transform duration-[950ms]"
                style={{ transformStyle:'preserve-3d',
                  transform:cardPhase==='revealed'?'rotateY(180deg)':'rotateY(0deg)',
                  transitionTimingFunction:'cubic-bezier(.16,.88,.18,1)' }}>
                <div className={cn('absolute inset-0 rounded-2xl overflow-hidden', cardPhase==='suspense'&&'animate-[cardShake_.15s_ease-in-out_infinite]')}
                  style={{ backfaceVisibility:'hidden' }}>
                  <CardBackDisplay gradient={cardBack.gradient} pattern={cardBack.pattern} imageUrl={cardBack.imageUrl} />
                  {!cardBack.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-white/40" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-[#050210]"
                  style={{ backfaceVisibility:'hidden', transform:'rotateY(180deg)',
                    boxShadow:'0 20px 60px rgba(0,0,0,.8)', border:'1px solid rgba(255,255,255,.08)',
                    overflow: 'visible' }}>
                  <CardHover
                    rarity={cardPhase === 'revealed' ? currentCard.rarity : 'common'}
                    className="absolute inset-0 rounded-2xl"
                  >
                    <CardFrame rarity={cardPhase === 'revealed' ? currentCard.rarity : 'common'} name={cardPhase === 'revealed' ? currentCard.name : undefined} style={{ position:'absolute', inset:0 }}>
                      {currentCard.artUrl
                        ? <CardMedia src={currentCard.artUrl} alt={currentCard.name} />
                        : <div className="w-full h-full flex items-center justify-center">
                            <div className="w-20 h-20 rounded-full opacity-40"
                              style={{ background:`radial-gradient(circle,${revealedColor||'#7b2bff'},transparent)` }} />
                          </div>
                      }
                    </CardFrame>
                  </CardHover>
                </div>
              </div>
            </div>
          </div>

          {/* Nom + rareté */}
          <div className={cn('flex flex-col items-center gap-0.5 transition-all duration-300 z-10',
            cardPhase==='revealed'?'opacity-100 translate-y-0':'opacity-0 translate-y-2')}>
            {cardPhase === 'revealed' && newCardIds.has(currentCard.id) && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs tracking-widest uppercase mb-1"
                style={{
                  background:'linear-gradient(135deg,#92400e,#f59e0b,#fde68a)',
                  color:'#fff',
                  boxShadow:'0 0 20px rgba(251,191,36,.8), 0 0 50px rgba(245,158,11,.4)',
                  textShadow:'0 1px 3px rgba(0,0,0,.5)',
                  animation:'newCardPop .55s cubic-bezier(.34,1.56,.64,1) both',
                }}>
                ✦ Nouvelle carte !
              </div>
            )}
            <p className="text-white font-bold text-base uppercase">{currentCard.name}</p>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color:revealedColor||'#9ca3af' }}>
              {currentCard.rarity}
            </p>
            {currentCard.artist && (
              <p className="text-white/35 text-[10px] mt-0.5">
                🎨 Artiste:{' '}
                {currentCard.artistUrl ? (
                  <a href={currentCard.artistUrl} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[#a78bfa] hover:text-white underline underline-offset-2 transition-colors">
                    {currentCard.artist}
                  </a>
                ) : (
                  currentCard.artist
                )}
              </p>
            )}
          </div>

          <p className="text-white/30 text-xs z-10">
            {cardPhase==='back'?'Clique pour révéler'
              :cardPhase==='suspense'?''
              :isLast?'Clique pour voir le résumé'
              :`Clique pour continuer · ${cardIndex+1} / ${cards.length}`}
          </p>
        </div>
      )}
    </div>
  )
}

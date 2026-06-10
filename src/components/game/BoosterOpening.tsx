'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { CardModal } from '@/components/game/CardModal'
import { useAchievements } from '@/hooks/useAchievements'

interface Card {
  id: string
  name: string
  rarity: string
  family?: string
  artUrl?: string
  description?: string | null
}

interface Props {
  cards: Card[]
  boosterImageUrl?: string
  boosterType?: string
  onClose: () => void
}

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}
const RARITY_BG: Record<string, string> = {
  void:      'radial-gradient(ellipse at 50% 0%, #1a0a3a 0%, #050210 60%, #000 100%)',
  legendary: 'radial-gradient(ellipse at 50% 0%, #2a1800 0%, #100800 60%, #000 100%)',
  epic:      'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0a0518 60%, #000 100%)',
  rare:      'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #040810 60%, #000 100%)',
  uncommon:  'radial-gradient(ellipse at 50% 0%, #0a1f10 0%, #040a06 60%, #000 100%)',
  common:    'radial-gradient(ellipse at 50% 0%, #111118 0%, #060608 60%, #000 100%)',
}
const SUSPENSE_MS: Record<string, number> = {
  void: 2800, legendary: 2800, epic: 1500, rare: 1000, uncommon: 580, common: 420,
}
const PARTICLE_COUNT: Record<string, number> = {
  void: 60, legendary: 45, epic: 28, rare: 18, uncommon: 0, common: 0,
}
const TEAR_Y = 14

function hexToRgba(hex: string, a: number) {
  const v = hex.replace('#','')
  const b = parseInt(v.length===3?v.split('').map(c=>c+c).join(''):v,16)
  return `rgba(${(b>>16)&255},${(b>>8)&255},${b&255},${a})`
}

interface Particle { id:number; x:number; y:number; color:string; size:number; delay:number; dur:number; vx:number; vy:number }

type Phase = 'idle'|'tearing'|'torn'|'cards'|'results'
type CardPhase = 'back'|'suspense'|'revealed'

// ── Écran de résultats ────────────────────────────────────────────────────────
function ResultsScreen({ cards, boosterType = 'void', onClose }: { cards: Card[]; boosterType?: string; onClose: () => void }) {
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
    void: 500, legendary: 300, epic: 150, rare: 80, uncommon: 30, common: 10,
  }

  async function handleSave() {
    if (!user || saving || saved) return
    setSaving(true)
    try {
      const sb = createClient()
      const rows = cards.map(c => ({
        user_id: user.id, card_id: c.id, rarity: c.rarity,
        family: c.family ?? 'void',
        metadata: { name: c.name, image_url: c.artUrl ?? null, source: 'pack' },
      }))
      await sb.from('player_cards').insert(rows)
      const totalXP = cards.reduce((sum, c) => sum + (XP_PER_RARITY[c.rarity] ?? 10), 0)
      setXpGain(totalXP)
      const { data: updated } = await sb
        .from('player_profiles')
        .update({ xp: (profile?.xp ?? 0) + totalXP })
        .eq('user_id', user.id)
        .select('level, xp').single()
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

      // Succès + missions
      const { data: allCards } = await sb.from('player_cards').select('card_id').eq('user_id', user.id)
      const uniqueCount = new Set((allCards ?? []).map((c: {card_id: string}) => c.card_id)).size
      const { data: packData } = await sb.from('player_profiles').select('packs_opened').eq('user_id', user.id).single()
      await checkAfterPackOpen(cards, packData?.packs_opened ?? 1, uniqueCount, boosterType)

      setSaved(true); setShowXP(true)
      setTimeout(() => setShowXP(false), 2500)
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const bestRarity = cards.reduce((best, c) => {
    const order = ['void','legendary','epic','rare','uncommon','common']
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
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-bold">
            Terminer ✓
          </button>
        )}
      </div>

      {/* Grille petites cartes */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
          {cards.map((card, i) => (
            <button key={i} onClick={() => setSelected(card)}
              className="relative rounded-xl overflow-hidden active:scale-95 transition-transform flex-shrink-0"
              style={{
                width: 'clamp(120px, 18vw, 200px)',
                height: 'clamp(168px, 25vw, 280px)',
                background:RARITY_BG[card.rarity]??RARITY_BG.common,
                boxShadow:`0 0 10px ${hexToRgba(RARITY_COLOR[card.rarity]??'#7b2bff',.3)}`,
                border:`1px solid ${hexToRgba(RARITY_COLOR[card.rarity]??'#7b2bff',.25)}`,
                animation:`cardFadeIn .4s ease-out ${i*.07}s both`,
              }}>
              {card.artUrl
                ? <Image src={card.artUrl} alt={card.name} fill className="object-contain" unoptimized />
                : <Image src="/assets/dos.png" alt={card.name} fill className="object-cover" />
              }
              <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-0.5">
                <span className="text-[7px] font-black uppercase tracking-wider" style={{ color:RARITY_COLOR[card.rarity] }}>
                  {card.rarity}
                </span>
              </div>
            </button>
          ))}
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function BoosterOpening({ cards, boosterImageUrl, onClose }: Props) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [cardIndex, setCardIndex]   = useState(0)
  const [cardPhase, setCardPhase]   = useState<CardPhase>('back')
  const [revealedColor, setRevealedColor] = useState('')
  const [bgStyle, setBgStyle]       = useState('radial-gradient(ellipse at 50% 30%, #0d0520 0%, #000 100%)')
  const [auraColor, setAuraColor]   = useState('')
  const [raysColor, setRaysColor]   = useState('')
  const [particles, setParticles]   = useState<Particle[]>([])
  const [shake, setShake]           = useState(false)

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
    const W = canvas.offsetWidth || 300
    const H = canvas.offsetHeight || 400
    canvas.width  = W * 2
    canvas.height = H * 2
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    const colors = ['#ffffff','#a78bfa','#7b2bff','#c4b5fd','#e0d7ff']
    const pts = Array.from({ length: 28 }, () => ({
      x: W * (.2 + Math.random() * .6),
      y: H * TEAR_Y / 100,
      vx: (Math.random() - .5) * 6,
      vy: -2 - Math.random() * 5,
      r: 1.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: .018 + Math.random() * .025,
    }))

    cancelAnimationFrame(tearRafRef.current)
    function frame() {
      ctx.clearRect(0, 0, W, H)
      let alive = false
      for (const p of pts) {
        if (p.life <= 0) continue
        alive = true
        p.x += p.vx; p.y += p.vy
        p.vy += .12 // gravité légère
        p.life -= p.decay
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life
        ctx.shadowBlur = p.r * 4
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
        setCardIndex(i => i+1); setCardPhase('back')
      } else { setPhase('results') }
    }
  }, [cardPhase, rarity, isLast]) // eslint-disable-line

  if (phase === 'results') return <ResultsScreen cards={cards} boosterType={boosterType ?? 'void'} onClose={onClose} />

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700', shake && 'animate-[screenShake_.4s_ease-in-out]')}
      style={{ background: bgStyle }}
    >
      {/* ── IDLE / TEARING ── */}
      {(phase === 'idle' || phase === 'tearing') && (
        <div onClick={handleTear} className="relative flex flex-col items-center gap-8 cursor-pointer select-none">
          {/* Canvas particules déchirure */}
          <canvas ref={tearCanvasRef} className="absolute pointer-events-none"
            style={{ top: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(72vw,300px)', height: '100%', overflow: 'visible' }} />

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
                  style={{ backfaceVisibility:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.8)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <Image src="/assets/dos.png" alt="" fill className="object-cover" />
                </div>
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-[#050210]"
                  style={{ backfaceVisibility:'hidden', transform:'rotateY(180deg)',
                    boxShadow:'0 20px 60px rgba(0,0,0,.8)', border:'1px solid rgba(255,255,255,.08)' }}>
                  {currentCard.artUrl
                    ? <Image src={currentCard.artUrl} alt={currentCard.name} fill className="object-contain" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full opacity-40"
                          style={{ background:`radial-gradient(circle,${revealedColor||'#7b2bff'},transparent)` }} />
                      </div>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Nom + rareté */}
          <div className={cn('flex flex-col items-center gap-0.5 transition-all duration-300 z-10',
            cardPhase==='revealed'?'opacity-100 translate-y-0':'opacity-0 translate-y-2')}>
            <p className="text-white font-bold text-base">{currentCard.name}</p>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color:revealedColor||'#9ca3af' }}>
              {currentCard.rarity}
            </p>
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

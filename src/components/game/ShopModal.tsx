'use client'
import { Lock, Check, Coffee, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/game'
import { CardBackDisplay } from '@/components/game/CardBackDisplay'
const KOFI_URL = 'https://ko-fi.com/voidpack'

interface CardBack { id: string; name: string; gradient: string; pattern: string; imageUrl?: string | null; image_url?: string | null }
interface Arena { id: string; name: string; imageUrl?: string | null; image_url?: string | null; gradient?: string | null }

export function ShopModal({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useGameStore(s => ({ profile: s.profile, setProfile: s.setProfile }))
  const [cardBacks, setCardBacks] = useState<CardBack[]>([])
  const [arenas, setArenas]       = useState<Arena[]>([])
  const [selectedArena, setSelectedArena] = useState<string>('default')
  const [loading, setLoading]     = useState(true)

  const unlocked    = profile?.unlocked_card_backs ?? ['default']
  const selected    = profile?.selected_card_back ?? 'default'
  const isSubscriber = profile?.is_subscriber ?? false
  const ownedArenas  = profile?.owned_arenas ?? []

  useEffect(() => {
    fetch('/api/card-backs')
      .then(r => r.json())
      .then(data => { setCardBacks(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/arenas').then(r => r.json()).then(d => setArenas(d ?? [])).catch(() => {})
    fetch('/api/profile/arena').then(r => r.json()).then(d => setSelectedArena(d?.arenaId ?? 'default')).catch(() => {})
  }, [])

  async function selectArena(id: string) {
    setSelectedArena(id)
    await fetch('/api/profile/arena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arenaId: id }),
    })
  }

  async function selectBack(id: string) {
    if (!profile) return
    setProfile({ ...profile, selected_card_back: id })
    await fetch('/api/profile/card-back', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardBackId: id }),
    })
  }

  const [kofiStep, setKofiStep]   = useState<'idle' | 'email'>('idle')
  const [kofiEmail, setKofiEmail] = useState(profile?.kofi_email ?? '')
  const [kofiSaving, setKofiSaving] = useState(false)

  async function startSubscribe() {
    if (profile?.kofi_email) {
      window.open(KOFI_URL, '_blank', 'noopener,noreferrer')
    } else {
      setKofiStep('email')
    }
  }

  async function confirmSubscribe() {
    const email = kofiEmail.trim()
    if (!email) return
    setKofiSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kofiEmail: email }),
    })
    if (profile) setProfile({ ...profile, kofi_email: email })
    setKofiSaving(false)
    setKofiStep('idle')
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer')
  }

  const canUse = (skin: CardBack) => isSubscriber || unlocked.includes(skin.id)

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[680px] lg:w-[820px] h-[92vh] sm:h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">

        {/* ── Header sticky ── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Coffee size={18} /> Soutien</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
          </div>

          {/* Abonnement */}
          <div className="rounded-2xl border p-4"
            style={{
              background: isSubscriber ? 'rgba(0,200,150,0.06)' : 'linear-gradient(135deg, rgba(123,43,255,0.15), rgba(74,31,168,0.10))',
              borderColor: isSubscriber ? 'rgba(0,200,150,0.3)' : 'rgba(123,43,255,0.35)',
            }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black text-base flex items-center gap-2">
                  Abonnement VOID Pack
                  {isSubscriber && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4a9e6a]/20 text-[#4a9e6a] font-bold">Actif</span>}
                </p>
                <p className="text-white/50 text-xs mt-1">4,99€ / mois · Tout débloqué + 5 boosters offerts</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {['Tous les dos de carte débloqués', 'Tous les fonds d\'arène débloqués', '5 boosters VOID offerts par mois', 'Badge abonné sur le profil'].map(b => (
                    <span key={b} className="text-white/60 text-[10px] flex items-center gap-1"><Check size={12} /> {b}</span>
                  ))}
                </div>
              </div>
              {!isSubscriber && kofiStep === 'idle' && (
                <button onClick={startSubscribe}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                  <Coffee size={14} /> S&apos;abonner sur Ko-fi
                </button>
              )}
            </div>

            {/* Étape email avant redirection Ko-fi */}
            {kofiStep === 'email' && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/70 text-xs mb-2">
                  Entre l&apos;email de ton compte Ko-fi pour qu&apos;on puisse activer tes avantages automatiquement.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={kofiEmail}
                    onChange={e => setKofiEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmSubscribe()}
                    placeholder="ton-email@ko-fi.com"
                    autoFocus
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl text-white text-xs px-3 py-2 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={confirmSubscribe}
                    disabled={kofiSaving || !kofiEmail.trim()}
                    className="px-3 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                    <Coffee size={12} /> {kofiSaving ? '…' : 'Continuer'}
                  </button>
                  <button onClick={() => setKofiStep('idle')} className="px-3 py-2 rounded-xl text-white/30 text-xs hover:text-white/60">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-4">
            Dos de carte
            {isSubscriber && <span className="ml-2 text-[#4a9e6a]">· Tous débloqués avec ton abonnement</span>}
          </p>
        </div>

        {/* ── Grille scrollable ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-4 text-center text-white/30 text-sm py-8">Chargement…</div>
            ) : cardBacks.map(skin => {
              const accessible = canUse(skin)
              const isSelected = selected === skin.id
              const owned      = unlocked.includes(skin.id)
              const isDefault  = skin.id === 'default'

              return (
                <div key={skin.id} className="rounded-2xl overflow-hidden border"
                  style={{
                    borderColor: isSelected ? '#7b2bff' : 'rgba(255,255,255,0.08)',
                    borderWidth: isSelected ? '2px' : '1px',
                  }}>
                  <div className="aspect-[0.714] relative cursor-pointer overflow-hidden"
                    style={{ opacity: accessible ? 1 : 0.45 }}
                    onClick={() => accessible && selectBack(skin.id)}>
                    <CardBackDisplay gradient={skin.gradient} pattern={skin.pattern} imageUrl={skin.imageUrl ?? skin.image_url} />
                    {!(skin.imageUrl ?? skin.image_url) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-white/40" />
                        </div>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#7b2bff] flex items-center justify-center"><Check size={12} className="text-white" /></div>
                    )}
                    {!accessible && (
                      <div className="absolute top-2 right-2"><Lock size={12} className="text-white/60" /></div>
                    )}
                  </div>
                  <div className="p-2.5 bg-white/[0.03]">
                    <p className="text-white text-xs font-bold">{skin.name}</p>
                    <div className="mt-1.5">
                      {isDefault ? (
                        <p className="text-white/30 text-[10px]">Gratuit</p>
                      ) : accessible ? (
                        <p className="text-[#4a9e6a] text-[10px]">{isSubscriber && !owned ? 'Via abonnement' : 'Débloqué'}</p>
                      ) : (
                        <button onClick={startSubscribe}
                          className="w-full py-1 rounded-lg text-[10px] font-bold text-white/70 transition-all flex items-center justify-center gap-1"
                          style={{ background: 'rgba(123,43,255,0.25)' }}>
                          <Lock size={10} /> Abonnés
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Arènes de combat ── */}
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-7 mb-3">
            Fonds d&apos;arène - change le décor de tes combats
            {isSubscriber && <span className="ml-2 text-[#4a9e6a]">· Tous débloqués avec ton abonnement</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {arenas.map(arena => {
              const img        = arena.imageUrl ?? arena.image_url
              const isDefault  = arena.id === 'default'
              const accessible = isDefault || isSubscriber || ownedArenas.includes(arena.id)
              const isSel      = selectedArena === arena.id
              return (
                <div key={arena.id} className="rounded-2xl overflow-hidden border"
                  style={{ borderColor: isSel ? '#7b2bff' : 'rgba(255,255,255,0.08)', borderWidth: isSel ? '2px' : '1px' }}>
                  <div className="aspect-[16/9] relative cursor-pointer overflow-hidden"
                    style={{ opacity: accessible ? 1 : 0.45, background: arena.gradient ?? '#08031a' }}
                    onClick={() => accessible && selectArena(arena.id)}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={arena.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    )}
                    {isSel && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#7b2bff] flex items-center justify-center"><Check size={12} className="text-white" /></div>
                    )}
                    {!accessible && <div className="absolute top-2 right-2"><Lock size={12} className="text-white/60" /></div>}
                  </div>
                  <div className="p-2.5 bg-white/[0.03] flex items-center justify-between">
                    <p className="text-white text-xs font-bold">{arena.name}</p>
                    {isDefault ? <p className="text-white/30 text-[10px]">Gratuit</p>
                      : accessible ? <p className="text-[#4a9e6a] text-[10px]">Débloqué</p>
                      : <p className="text-white/40 text-[10px]">Via abonnement</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Ko-Fi sticky bas ── */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06]">
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#7b2bff]/25 hover:border-[#7b2bff]/50 transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(123,43,255,0.08), rgba(74,31,168,0.05))' }}>
            <Coffee size={20} className="text-[#a78bfa] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Soutenir sur Ko-fi</p>
              <p className="text-white/40 text-xs">Don libre, sans contrepartie</p>
            </div>
            <span className="text-white/30 text-sm">↗</span>
          </a>
        </div>

      </div>
    </div>
  )
}

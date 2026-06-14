'use client'
import { Lock, Check, Coffee, Crown, Gift, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'

const KOFI_URL = 'https://ko-fi.com/voidpack'

interface CardBack { id: string; name: string; gradient: string; pattern: string }

export function ShopModal({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useGameStore(s => ({ profile: s.profile, setProfile: s.setProfile }))
  const [cardBacks, setCardBacks] = useState<CardBack[]>([])
  const [loading, setLoading]     = useState(true)
  const [buying, setBuying]       = useState<string | null>(null)

  const unlocked    = profile?.unlocked_card_backs ?? ['default']
  const selected    = profile?.selected_card_back ?? 'default'
  const isSubscriber = profile?.is_subscriber ?? false

  useEffect(() => {
    createClient()
      .from('card_backs')
      .select('id,name,gradient,pattern')
      .eq('active', true)
      .order('order_index')
      .then(({ data }) => { setCardBacks(data ?? []); setLoading(false) })
  }, [])

  async function selectBack(id: string) {
    if (!profile) return
    setProfile({ ...profile, selected_card_back: id })
    await createClient().from('player_profiles').update({ selected_card_back: id }).eq('user_id', profile.user_id)
  }

  async function checkout(mode: 'subscription' | 'payment', skin?: CardBack) {
    setBuying(mode === 'subscription' ? 'sub' : (skin?.id ?? ''))
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          card_back_id:   skin?.id,
          card_back_name: skin?.name,
        }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors du paiement')
    } finally { setBuying(null) }
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
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Gift size={18} /> Boutique</h2>
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
                  {isSubscriber && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00c896]/20 text-[#00c896] font-bold">Actif</span>}
                </p>
                <p className="text-white/50 text-xs mt-1">2,99€ / mois · Tous les dos débloqués + 3 boosters/mois</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {['Tous les dos de carte débloqués', '3 boosters VOID offerts par mois', 'Badge abonné sur le profil'].map(b => (
                    <span key={b} className="text-white/60 text-[10px] flex items-center gap-1"><Check size={12} /> {b}</span>
                  ))}
                </div>
              </div>
              {!isSubscriber && (
                <button onClick={() => checkout('subscription')} disabled={buying === 'sub'}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                  {buying === 'sub' ? '…' : "S'abonner"}
                </button>
              )}
            </div>
          </div>

          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-4">
            Dos de carte — 1,00€ l&apos;unité
            {isSubscriber && <span className="ml-2 text-[#00c896]">· Tous débloqués avec ton abonnement</span>}
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
                  <div className="aspect-[0.714] relative cursor-pointer"
                    style={{ background: skin.gradient, opacity: accessible ? 1 : 0.45 }}
                    onClick={() => accessible && selectBack(skin.id)}>
                    <div className="absolute inset-0" style={{ background: skin.pattern }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-white/40" />
                      </div>
                    </div>
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
                        <p className="text-[#00c896] text-[10px]">{isSubscriber && !owned ? 'Via abonnement' : 'Débloqué'}</p>
                      ) : (
                        <button onClick={() => checkout('payment', skin)} disabled={buying === skin.id}
                          className="w-full py-1 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50"
                          style={{ background: 'rgba(123,43,255,0.4)' }}>
                          {buying === skin.id ? '…' : '1,00€ — Acheter'}
                        </button>
                      )}
                    </div>
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

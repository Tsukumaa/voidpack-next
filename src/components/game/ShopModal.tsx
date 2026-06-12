'use client'
import { useGameStore } from '@/store/game'
import { createClient } from '@/lib/supabase/client'

const KOFI_URL = 'https://ko-fi.com/voidpack'

const CARD_BACKS = [
  {
    id: 'default',
    name: 'Originel',
    gradient: 'linear-gradient(135deg, #1a0b2e 0%, #4a1fa8 50%, #2a0a4d 100%)',
    pattern: 'radial-gradient(circle at 50% 50%, rgba(123,43,255,0.25), transparent 60%)',
  },
  {
    id: 'nebula',
    name: 'Nébuleuse',
    gradient: 'linear-gradient(135deg, #1a0b3d 0%, #4a1fa8 45%, #00c8e0 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 50%)',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    gradient: 'linear-gradient(135deg, #2a0a05 0%, #ff6a00 50%, #ffd700 100%)',
    pattern: 'radial-gradient(circle at 70% 70%, rgba(255,255,255,0.2), transparent 50%)',
  },
  {
    id: 'abyss',
    name: 'Abysse',
    gradient: 'linear-gradient(135deg, #000000 0%, #0a2e4d 50%, #00ffc8 100%)',
    pattern: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.12), transparent 60%)',
  },
  {
    id: 'royal',
    name: 'Royal',
    gradient: 'linear-gradient(135deg, #1f0a3d 0%, #7b2bff 40%, #ff9ad5 100%)',
    pattern: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1), transparent 55%)',
  },
]

export function ShopModal({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useGameStore(s => ({ profile: s.profile, setProfile: s.setProfile }))
  const unlocked = profile?.unlocked_card_backs ?? ['default']
  const selected = profile?.selected_card_back ?? 'default'

  async function selectBack(id: string) {
    if (!profile) return
    setProfile({ ...profile, selected_card_back: id })
    await createClient()
      .from('player_profiles')
      .update({ selected_card_back: id })
      .eq('user_id', profile.user_id)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[480px] sm:max-h-[85vh] max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 p-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-white">🎁 Boutique</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none px-2">×</button>
        </div>
        <p className="text-white/40 text-xs mb-4">
          Sélectionne le dos de carte qui s&apos;affichera lors de l&apos;ouverture des boosters
        </p>

        {/* Card backs grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {CARD_BACKS.map(skin => {
            const isUnlocked = unlocked.includes(skin.id)
            const isSelected = selected === skin.id
            return (
              <button key={skin.id}
                onClick={() => isUnlocked && selectBack(skin.id)}
                disabled={!isUnlocked}
                className="rounded-2xl overflow-hidden text-left transition-all"
                style={{
                  border: isSelected ? '2px solid #7b2bff' : '1px solid rgba(255,255,255,0.1)',
                  opacity: isUnlocked ? 1 : 0.35,
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                <div className="aspect-[0.714] relative" style={{ background: skin.gradient, filter: isUnlocked ? 'none' : 'grayscale(0.6)' }}>
                  <div className="absolute inset-0" style={{ background: skin.pattern }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-white/40" />
                    </div>
                  </div>
                  <div className="absolute inset-0" style={{
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15), inset 0 0 30px rgba(0,0,0,0.4)'
                  }} />
                  {!isUnlocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-xs">
                      🔒
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#7b2bff] flex items-center justify-center text-xs text-white">
                      ✓
                    </div>
                  )}
                </div>
                <div className="p-2 text-center">
                  <p className="text-white text-xs font-bold">{skin.name}</p>
                  <p className="text-white/30 text-[10px] mt-0.5">
                    {isUnlocked ? (isSelected ? 'Sélectionné' : 'Disponible') : 'Verrouillé'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Ko-fi support */}
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-2xl border border-[#ff5e5b]/30 transition-all hover:border-[#ff5e5b]/60"
          style={{ background: 'linear-gradient(135deg, rgba(255,94,91,0.12), rgba(255,170,60,0.08))' }}
        >
          <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
            style={{ background: 'rgba(255,94,91,0.18)' }}>
            ☕
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Soutenir sur Ko-fi</p>
            <p className="text-white/40 text-xs mt-0.5">
              Débloque des dos de carte exclusifs en soutenant le projet
            </p>
          </div>
          <span className="text-white/30 text-lg">↗</span>
        </a>

        <p className="text-white/20 text-[10px] text-center mt-4">
          Les dos verrouillés sont débloqués manuellement après chaque don — merci pour ton soutien 💜
        </p>
      </div>
    </div>
  )
}

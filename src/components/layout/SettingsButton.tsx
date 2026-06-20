'use client'
import { useState, useRef, useEffect } from 'react'
import { Settings, Volume2, VolumeX, Music } from 'lucide-react'
import { useSettingsStore } from '@/store/settings'

export function SettingsButton() {
  const [open, setOpen]    = useState(false)
  const panelRef           = useRef<HTMLDivElement>(null)
  const volume             = useSettingsStore(s => s.musicVolume)
  const muted              = useSettingsStore(s => s.musicMuted)
  const setMusicVolume     = useSettingsStore(s => s.setMusicVolume)
  const setMusicMuted      = useSettingsStore(s => s.setMusicMuted)

  // Fermer en cliquant en dehors
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={panelRef} className="fixed bottom-40 right-4 z-[139] flex flex-col items-end gap-2">

      {/* Panel */}
      {open && (
        <div className="mb-1 w-56 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(10,8,20,0.92)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>

          <div className="px-3.5 py-3 border-b border-white/[0.06]">
            <p className="text-white/80 text-xs font-bold tracking-wide uppercase">Paramètres</p>
          </div>

          <div className="px-3.5 py-3 space-y-3">
            {/* Musique */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Music size={12} />
                  Musique
                </div>
                <button
                  onClick={() => setMusicMuted(!muted)}
                  className="flex items-center gap-1 text-xs font-bold transition-colors"
                  style={{ color: muted ? 'rgba(255,255,255,0.3)' : '#a855f7' }}>
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {muted ? 'Off' : 'On'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <VolumeX size={11} className="text-white/20 shrink-0" />
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((muted ? 0 : volume) * 100)}
                  onChange={e => {
                    const v = parseInt(e.target.value) / 100
                    setMusicVolume(v)
                    if (v > 0 && muted) setMusicMuted(false)
                    if (v === 0) setMusicMuted(true)
                  }}
                  className="flex-1 cursor-pointer"
                  style={{
                    accentColor: '#a855f7',
                    height: '4px',
                  }}
                />
                <Volume2 size={11} className="text-white/20 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          background: open ? 'rgba(123,43,255,0.25)' : 'rgba(10,8,20,0.75)',
          border: `1px solid ${open ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
          backdropFilter: 'blur(16px)',
          color: open ? '#a855f7' : 'rgba(255,255,255,0.5)',
        }}>
        <Settings size={18} style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s ease' }} />
      </button>
    </div>
  )
}

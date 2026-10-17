'use client'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Swords, Gift, Lock, Check, X, Timer } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { useBoosterCredits } from '@/hooks/useBoosterCredits'
import { cn } from '@/lib/utils'
import { useRaid, raidDeadline, RAID_OBJECTIVE_LABELS, type RaidInfo, type RaidMe } from '@/hooks/useRaid'

const fmt = (n: number) => n.toLocaleString('fr-FR')

// Temps restant avant la fin du raid : "2j 04h", "3h 12min", puis "12:05" la dernière heure
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Terminé'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d}j ${pad(h)}h`
  if (h > 0) return `${h}h ${pad(m)}min`
  return `${pad(m)}:${pad(sec)}`
}

// Compte à rebours : tick chaque seconde la dernière heure, sinon toutes les 30 s
function useRemaining(endsAt: string | null | undefined): number | null {
  const end = endsAt ? new Date(endsAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!end) return
    const remaining = end - Date.now()
    if (remaining <= 0) return
    const id = setTimeout(() => setNow(Date.now()), remaining < 3600_000 ? 1000 : 30_000)
    return () => clearTimeout(id)
  }, [end, now])
  return end ? end - now : null
}

// prefix/suffix : donnent le sens du temps affiché ("fin dans …", "… restantes pour réclamer").
// Sur mobile, prefix est masqué et suffix remplacé par mobileSuffix (plus court) pour laisser de la place au titre.
function RaidTimer({ endsAt, className, prefix, suffix, mobileSuffix }: {
  endsAt: string | null; className?: string; prefix?: string; suffix?: string; mobileSuffix?: string
}) {
  const remaining = useRemaining(endsAt)
  if (remaining === null) return null
  const urgent = remaining > 0 && remaining < 3600_000
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums whitespace-nowrap text-white/60', className, urgent && 'text-red-400')}>
      <Timer size={11} className="shrink-0" />
      {prefix && <span className="hidden sm:inline font-semibold">{prefix}</span>}
      {formatRemaining(remaining)}
      {suffix && <span className="hidden sm:inline font-semibold">{suffix}</span>}
      {mobileSuffix && <span className="sm:hidden font-semibold">{mobileSuffix}</span>}
    </span>
  )
}
const familyLabel = (key: string) => key === 'void' ? 'Void' : key.charAt(0).toUpperCase() + key.slice(1)

// Jauge du raid communautaire, affichée dans le header de toutes les pages.
// Un clic ouvre le détail (paliers, participation, bouton Réclamer).
export function RaidBanner() {
  const { raid, applyRaid, activity } = useRaid()
  const user = useGameStore(s => s.user)
  const { loadCredits } = useBoosterCredits()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<RaidMe | null>(null)
  const [scrolled, setScrolled] = useState(false)

  const raidId = raid?.id
  // Masque la bannière dès l'échéance, sans attendre le prochain poll
  const remaining = useRemaining(raid ? raidDeadline(raid) : null)

  // Participation du joueur + état à jour du raid, en une seule requête.
  // Appelé seulement à l'ouverture du détail, après une action qui compte et après une réclamation.
  const loadMe = useCallback(async () => {
    if (!raidId || !user) { setMe(null); return }
    const res = await fetch(`/api/raid/me?raidId=${raidId}`)
    if (!res.ok) return
    const data = await res.json() as RaidMe & { raid: RaidInfo | null }
    setMe({ contribution: data.contribution, claimedTiers: data.claimedTiers })
    applyRaid(data.raid)
  }, [raidId, user, applyRaid])

  // Action du joueur comptant pour le raid (filtrée par type dans useRaid)
  useEffect(() => { if (activity > 0) loadMe() }, [activity]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!raid) return
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [raid])

  if (!raid || (remaining !== null && remaining <= 0)) return null

  const pct = Math.min(100, (raid.progress / raid.goal) * 100)
  const done = raid.phase === 'claim'

  return (
    <>
      <div className="flex justify-center mt-2">
        <button onClick={() => { setOpen(true); loadMe() }}
          className="relative w-full max-w-2xl flex flex-col gap-1 rounded-xl text-left transition-all duration-300 hover:brightness-110"
          style={{
            background: 'linear-gradient(90deg, #1a0f2e, #120a24, #1a0f2e)',
            border: '1px solid rgba(251,146,60,0.35)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 14px rgba(251,146,60,0.15)',
            padding: scrolled ? '4px 10px' : '6px 12px',
            maxWidth: scrolled ? 360 : 672,
          }}>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold">
            <Swords size={scrolled ? 11 : 13} className="text-orange-400 shrink-0" />
            <span className="font-black tracking-wide text-orange-300 shrink-0">RAID</span>
            <span className={cn('text-white/70 truncate', scrolled && 'hidden')}>{raid.title}</span>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              {done ? (
                // Objectif atteint : seulement le temps restant pour réclamer
                <RaidTimer endsAt={raidDeadline(raid)} className="text-yellow-300"
                  suffix={scrolled ? undefined : ' restantes pour réclamer les récompenses'}
                  mobileSuffix={scrolled ? undefined : ' pour réclamer'} />
              ) : (
                <>
                  <span className="tabular-nums text-white/80">
                    {scrolled ? `${Math.floor(pct)}%` : `${fmt(raid.progress)} / ${fmt(raid.goal)}`}
                  </span>
                  <RaidTimer endsAt={raidDeadline(raid)} prefix={scrolled ? undefined : 'fin dans'} />
                </>
              )}
            </div>
          </div>
          <RaidGauge raid={raid} thin />
        </button>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <RaidModal raid={raid} me={me} loggedIn={!!user}
          onClose={() => setOpen(false)}
          onClaimed={() => {
            loadMe()
            loadCredits(true) // les boosters gagnés apparaissent tout de suite dans la page pack
          }} />,
        document.body,
      )}
    </>
  )
}

// Jauge avec repères de paliers
function RaidGauge({ raid, thin = false }: { raid: RaidInfo; thin?: boolean }) {
  const pct = Math.min(100, (raid.progress / raid.goal) * 100)
  return (
    <div className={cn('relative w-full rounded-full bg-white/10', thin ? 'h-1' : 'h-3')}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f97316, #facc15)', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
      {raid.tiers.map((t, i) => {
        const left = Math.min(100, (t.threshold / raid.goal) * 100)
        const done = raid.progress >= t.threshold
        return (
          <div key={i} className={cn('absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border',
            thin ? 'w-1.5 h-1.5' : 'w-3.5 h-3.5', done ? 'bg-yellow-300 border-yellow-100' : 'bg-[#1a0f2e] border-white/40')}
            style={{ left: `${left}%` }} />
        )
      })}
    </div>
  )
}

function RaidModal({ raid, me, loggedIn, onClose, onClaimed }: {
  raid: RaidInfo; me: RaidMe | null; loggedIn: boolean
  onClose: () => void; onClaimed: () => void
}) {
  const [claiming, setClaiming] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const objective = RAID_OBJECTIVE_LABELS[raid.objectiveType] ?? { label: raid.objectiveType, unit: '' }
  const contribution = me?.contribution ?? 0
  const eligible = contribution >= raid.minContribution

  async function claim(tier: number) {
    setClaiming(tier); setMsg(null)
    try {
      const res = await fetch('/api/raid/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raidId: raid.id, tier }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.error ?? 'Erreur', ok: false }); return }
      setMsg({ text: `${data.boosters} booster${data.boosters > 1 ? 's' : ''} ajouté${data.boosters > 1 ? 's' : ''} à tes crédits !`, ok: true })
      onClaimed()
    } catch { setMsg({ text: 'Erreur réseau', ok: false }) }
    finally { setClaiming(null) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[480px] max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-orange-500/20 overflow-hidden">

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-orange-400 uppercase">
              <Swords size={12} /> {raid.phase === 'claim' ? 'Raid réussi' : 'Raid en cours'}
            </p>
            <h3 className="text-white font-black text-lg leading-tight mt-1">{raid.title}</h3>
            {raid.description && <p className="text-white/50 text-xs mt-1">{raid.description}</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Jauge globale */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-white/50">Objectif : {objective.label.toLowerCase()}</span>
              <span className={cn('font-black tabular-nums', raid.progress >= raid.goal ? 'text-yellow-300' : 'text-white')}>
                {fmt(Math.min(raid.progress, raid.goal))} / {fmt(raid.goal)}{raid.progress >= raid.goal && ' · Objectif atteint !'}
              </span>
            </div>
            <RaidGauge raid={raid} />
            {raidDeadline(raid) && (
              <div className="flex items-center justify-between gap-2 text-[10px] text-white/30">
                <span>
                  {raid.phase === 'claim' ? 'Récompenses à réclamer avant le ' : 'Fin le '}
                  {new Date(raidDeadline(raid)!).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </span>
                <RaidTimer endsAt={raidDeadline(raid)} className="text-xs font-bold" />
              </div>
            )}
            {raid.phase === 'claim' && (
              <p className="text-[11px] text-yellow-300/80">Après ce délai, les récompenses non réclamées sont perdues.</p>
            )}
          </div>

          {/* Participation */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            {loggedIn ? (
              <>
                <p className="text-white text-sm font-bold">
                  Ta participation : <span className="text-orange-300">{fmt(contribution)}</span> {objective.unit}
                </p>
                <p className={cn('text-xs mt-0.5', eligible ? 'text-green-400/80' : 'text-white/40')}>
                  {eligible
                    ? 'Tu as droit aux récompenses des paliers atteints.'
                    : `Encore ${fmt(raid.minContribution - contribution)} pour avoir droit aux récompenses (minimum ${fmt(raid.minContribution)}).`}
                </p>
              </>
            ) : (
              <p className="text-white/50 text-sm">Connecte-toi pour participer au raid et gagner les récompenses.</p>
            )}
          </div>

          {/* Paliers */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Paliers</p>
            {raid.tiers.map((t, i) => {
              const reached = raid.progress >= t.threshold
              const claimed = me?.claimedTiers.includes(i) ?? false
              return (
                <div key={i} className={cn('flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border',
                  reached ? 'border-orange-500/30 bg-orange-500/[0.06]' : 'border-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-bold tabular-nums', reached ? 'text-white' : 'text-white/50')}>{fmt(t.threshold)} {objective.unit}</p>
                    <p className="text-xs text-white/50 flex items-center gap-1">
                      <Gift size={11} className="text-orange-300" />
                      {t.boosters} booster{t.boosters > 1 ? 's' : ''} {familyLabel(t.boosterType)}
                    </p>
                  </div>
                  {!reached ? (
                    <span className="flex items-center gap-1 text-[11px] text-white/30 shrink-0"><Lock size={11} /> Verrouillé</span>
                  ) : claimed ? (
                    <span className="flex items-center gap-1 text-[11px] text-green-400 font-bold shrink-0"><Check size={12} /> Réclamé</span>
                  ) : loggedIn && eligible ? (
                    <button onClick={() => claim(i)} disabled={claiming !== null}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 0 10px rgba(249,115,22,0.4)' }}>
                      {claiming === i ? '…' : 'Réclamer'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-white/30 shrink-0">Débloqué</span>
                  )}
                </div>
              )
            })}
          </div>

          {msg && <p className={cn('text-xs text-center', msg.ok ? 'text-green-400' : 'text-red-400')}>{msg.text}</p>}
        </div>
      </div>
    </div>
  )
}

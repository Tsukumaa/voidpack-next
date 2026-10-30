'use client'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Swords, Skull, Heart, X, Timer, Trophy, Check, Flame, Sparkles, BookOpen } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'
import { useRaid, raidDeadline, promoDaysStatus, type RaidInfo, type RaidMe } from '@/hooks/useRaid'
import { useCompactOnScroll } from '@/hooks/useCompactOnScroll'

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')

// Temps restant, toujours jusqu'aux secondes : "6j 23h 12min 05s", "3h 12min 05s", "12min 05s"
function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d}j ${pad(h)}h ${pad(m)}min ${pad(sec)}s`
  if (h > 0) return `${h}h ${pad(m)}min ${pad(sec)}s`
  return `${m}min ${pad(sec)}s`
}

// Compte à rebours : tick chaque seconde (affichage à la seconde)
function useRemaining(endsAt: string | null | undefined): number | null {
  const end = endsAt ? new Date(endsAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!end) return
    if (end - Date.now() <= 0) return
    const id = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(id)
  }, [end, now])
  return end ? end - now : null
}

// prefix masqué sur mobile pour laisser de la place au nom du boss
function RaidTimer({ endsAt, className, prefix }: { endsAt: string | null; className?: string; prefix?: string }) {
  const remaining = useRemaining(endsAt)
  if (remaining === null) return null
  const urgent = remaining > 0 && remaining < 3600_000
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums whitespace-nowrap text-white/60', className, urgent && 'text-red-400')}>
      <Timer size={11} className="shrink-0" />
      {prefix && <span className="hidden sm:inline font-semibold">{prefix}</span>}
      {formatRemaining(remaining)}
    </span>
  )
}

// Barre de PV du boss : rouge qui se vide ; une fois tué, barre dorée de dépassement
function BossHpBar({ raid, size = 'lg' }: { raid: RaidInfo; size?: 'thin' | 'md' | 'lg' }) {
  const hpLeft = Math.max(0, 1 - raid.damage / raid.hp)
  const overkill = raid.killed ? Math.min(1, (raid.damage - raid.hp) / raid.hp) : 0
  return (
    <div className={cn('relative w-full rounded-full overflow-hidden bg-white/10', size === 'thin' ? 'h-1' : size === 'md' ? 'h-2' : 'h-3')}>
      {raid.killed ? (
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(4, overkill * 100)}%`, background: 'linear-gradient(90deg,#facc15,#f97316)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
      ) : (
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${hpLeft * 100}%`, background: 'linear-gradient(90deg,#dc2626,#ef4444)', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
      )}
    </div>
  )
}

// Boss en tête de bannière, sans cadre : grand format, ancré en bas de la bannière et qui
// dépasse par le haut. Halo rouge pulsant directement autour de sa silhouette (PNG détouré
// idéalement). Vaincu → noir et blanc + crâne.
function BossPortrait({ raid }: { raid: RaidInfo }) {
  const defeated = raid.killed
  return (
    <div className="absolute left-1 bottom-0 z-10 w-[58px] h-[78px] sm:w-[74px] sm:h-[100px] pointer-events-none">
      {raid.bossImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={raid.bossImageUrl} alt={raid.bossName} draggable={false}
          className={cn('w-full h-full object-contain object-bottom select-none',
            defeated ? 'grayscale brightness-50' : 'boss-glow')}
          style={defeated ? { filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6)) grayscale(1) brightness(0.5)' } : undefined} />
      ) : (
        <div className="w-full h-full flex items-end justify-center pb-2">
          <Skull size={30} className={defeated ? 'text-white/40' : 'text-red-400 boss-glow'} />
        </div>
      )}
      {defeated && (
        <div className="absolute inset-0 flex items-center justify-center"><Skull size={20} className="text-yellow-300 drop-shadow" /></div>
      )}
    </div>
  )
}

// ── Dévoilement en puzzle ─────────────────────────────────────────────────────
// La carte est couverte de PUZZLE_COLS × PUZZLE_ROWS cases. Le nombre de cases révélées
// suit les dégâts en courbe (reveal²) : lent au début, la carte n'est reconnaissable
// qu'en fin de combat. L'ordre est aléatoire mais déterministe (graine = image), avec le
// centre (souvent le visage) révélé en dernier : tout le monde voit les mêmes cases, et une
// case révélée le reste quand reveal augmente.
const PUZZLE_COLS = 7
const PUZZLE_ROWS = 10
const PUZZLE_TILES = PUZZLE_COLS * PUZZLE_ROWS
const PUZZLE_CURVE = 2 // exposant : 60 % de dégâts → 36 % des cases, 90 % → 81 %

function puzzleRevealedCount(reveal: number): number {
  return Math.floor(Math.pow(Math.min(1, Math.max(0, reveal)), PUZZLE_CURVE) * PUZZLE_TILES)
}

function puzzleOrder(seedText: string): number[] {
  // Graine depuis le texte, puis mélange de Fisher-Yates avec un PRNG mulberry32
  let s = 0
  for (let i = 0; i < seedText.length; i++) s = (Math.imul(s, 31) + seedText.charCodeAt(i)) | 0
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // Score = hasard + proximité du centre : tri croissant → les bords partent en premier,
  // le centre en dernier (sans que ce soit un anneau trop régulier)
  const cx = (PUZZLE_COLS - 1) / 2, cy = (PUZZLE_ROWS - 1) / 2
  const maxDist = Math.hypot(cx, cy)
  const score = Array.from({ length: PUZZLE_TILES }, (_, i) => {
    const centerCloseness = 1 - Math.hypot(i % PUZZLE_COLS - cx, Math.floor(i / PUZZLE_COLS) - cy) / maxDist
    return rand() * 0.55 + centerCloseness * 0.45
  })
  return Array.from({ length: PUZZLE_TILES }, (_, i) => i).sort((a, b) => score[a] - score[b])
}

// Carte promo : cachée sous des cases qui se dévoilent une à une avec les dégâts infligés au boss
function PromoCard({ promo, size = 'md' }: { promo: NonNullable<RaidInfo['promo']>; size?: 'sm' | 'md' }) {
  const fullyRevealed = !!promo.name // nom révélé = boss tué → carte entièrement visible
  const revealedCount = fullyRevealed ? PUZZLE_TILES : puzzleRevealedCount(promo.reveal)
  const revealed = new Set(puzzleOrder(promo.imageUrl ?? '').slice(0, revealedCount))

  return (
    <div className={cn('relative rounded-xl overflow-hidden bg-black border border-white/10 shrink-0', size === 'sm' ? 'w-16' : 'w-28')}
      style={{ aspectRatio: '0.714' }}>
      {promo.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={promo.imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />
      )}
      {/* Cases du puzzle : les cases encore cachées recouvrent l'image */}
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${PUZZLE_COLS}, 1fr)`, gridTemplateRows: `repeat(${PUZZLE_ROWS}, 1fr)` }}>
        {Array.from({ length: PUZZLE_TILES }, (_, i) => (
          <div key={i} className="transition-opacity duration-700"
            style={{
              opacity: revealed.has(i) ? 0 : 1,
              background: (i + Math.floor(i / PUZZLE_COLS)) % 2 ? '#1a0d2e' : '#140a24',
              boxShadow: 'inset 0 0 0 0.5px rgba(168,85,247,0.25)',
            }} />
        ))}
      </div>
      {!fullyRevealed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/80 font-black text-lg" style={{ textShadow: '0 0 6px #000, 0 0 2px #000' }}>?</span>
        </div>
      )}
    </div>
  )
}

// Bannière du raid de boss (header de toutes les pages). Un clic ouvre le détail.
export function RaidBanner() {
  const { raid, refresh, applyRaid, activity } = useRaid()
  const user = useGameStore(s => s.user)
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<RaidMe | null>(null)
  // Compact au défilement, avec hystérésis (la version complète est bien plus haute : boss qui dépasse)
  const scrolled = useCompactOnScroll(!!raid)

  const raidId = raid?.id
  const phase = raid?.phase
  const remaining = useRemaining(raid ? raidDeadline(raid) : null)

  // Participation + état du raid en une requête : à l'ouverture du détail, après des dégâts,
  // et une fois à l'affichage du résultat (pour montrer ses récompenses)
  const loadMe = useCallback(async () => {
    if (!raidId || !user) { setMe(null); return }
    const res = await fetch(`/api/raid/me?raidId=${raidId}`)
    if (!res.ok) return
    const data = await res.json() as RaidMe & { raid: RaidInfo | null }
    setMe({
      damage: data.damage, missions: data.missions, missionDays: data.missionDays, lastMissionDay: data.lastMissionDay,
      rank: data.rank, manaReward: data.manaReward, promoGranted: data.promoGranted,
    })
    applyRaid(data.raid)
  }, [raidId, user, applyRaid])

  useEffect(() => { if (activity > 0) loadMe() }, [activity]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'results') loadMe() }, [phase, loadMe])

  // Fin du raid atteinte côté navigateur → on recharge (déclenche la distribution, affiche le résultat)
  const ended = phase === 'running' && remaining !== null && remaining <= 0
  useEffect(() => { if (ended) refresh(true) }, [ended, refresh])
  // Distribution en cours côté serveur : on revérifie un peu plus tard
  useEffect(() => {
    if (phase !== 'due') return
    const t = setTimeout(() => refresh(true), 5000)
    return () => clearTimeout(t)
  }, [phase, refresh])

  // Fin de l'affichage du résultat → bannière masquée
  if (!raid || (raid.phase === 'results' && remaining !== null && remaining <= 0)) return null

  const hpLeft = Math.max(0, raid.hp - raid.damage)
  // Dégâts en % des PV du boss (100 % = tué, au-delà = dépassement) : même écriture que la fenêtre
  const damagePct = Math.round(raid.damage / raid.hp * 100)

  return (
    <>
      {/* Marge haute plus grande en version complète : place pour le boss qui dépasse */}
      <div className={cn('flex justify-center transition-[margin] duration-300', scrolled ? 'mt-2' : 'mt-7 sm:mt-9')}>
        <button onClick={() => { setOpen(true); loadMe() }}
          className="relative w-full max-w-2xl flex flex-col gap-1 rounded-xl text-left transition-all duration-300 hover:brightness-110"
          style={{
            background: 'linear-gradient(90deg, #2a0f14, #160a12, #2a0f14)',
            border: `1px solid ${raid.killed ? 'rgba(250,204,21,0.45)' : 'rgba(239,68,68,0.4)'}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 14px rgba(239,68,68,0.15)',
            padding: scrolled ? '4px 10px' : '6px 12px',
            maxWidth: scrolled ? 560 : 672,
          }}>
          {scrolled ? (
            // Version compacte pendant le défilement
            <>
              {/* Une ligne : RAID BOSS · nom · PV · timer */}
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold">
                <Swords size={11} className="text-red-400 shrink-0" />
                <span className="font-black tracking-wide text-red-300 shrink-0 uppercase">Raid boss</span>
                <span className="text-white font-black truncate">{raid.bossName}</span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {raid.phase === 'results' ? (
                    raid.killed
                      ? <span className="inline-flex items-center gap-1 text-yellow-300"><Trophy size={11} />Vaincu</span>
                      : <span className="inline-flex items-center gap-1 text-white/50"><Skull size={11} />Survivant</span>
                  ) : (
                    <>
                      {raid.killed
                        ? <span className="inline-flex items-center gap-1 text-yellow-300 tabular-nums"><Skull size={11} />Vaincu · {damagePct} %</span>
                        : <span className="inline-flex items-center gap-1 text-red-300 tabular-nums"><Heart size={11} />{fmt(hpLeft)} PV</span>}
                      {raid.phase === 'running' && <RaidTimer endsAt={raid.endsAt} className="hidden sm:inline-flex" />}
                    </>
                  )}
                </div>
              </div>
              <BossHpBar raid={raid} size="thin" />
            </>
          ) : (
            // Version complète : le boss en tête, bien visible
            <div className="flex items-center">
              <BossPortrait raid={raid} />
              <div className="flex-1 min-w-0 flex flex-col gap-1 pl-[58px] sm:pl-[78px]">
                <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1 text-red-400 shrink-0"><Swords size={10} /> Raid boss</span>
                  <span className="ml-auto normal-case tracking-normal text-[10px] sm:text-xs font-bold">
                    {raid.phase === 'running' && <RaidTimer endsAt={raid.endsAt} prefix="fin dans" />}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-white font-black text-sm sm:text-base leading-tight truncate">
                    {raid.bossName}
                  </p>
                  <span className="ml-auto shrink-0 text-[10px] sm:text-xs font-bold tabular-nums">
                    {raid.phase === 'results' ? (
                      raid.killed
                        ? <span className="inline-flex items-center gap-1 text-yellow-300"><Trophy size={11} />Boss vaincu !</span>
                        : <span className="inline-flex items-center gap-1 text-white/50"><Skull size={11} />Le boss a survécu</span>
                    ) : raid.killed
                      ? <span className="inline-flex items-center gap-1 text-yellow-300"><Skull size={11} />Vaincu · {damagePct} %</span>
                      : <span className="inline-flex items-center gap-1 text-red-300"><Heart size={11} />{fmt(hpLeft)} PV</span>}
                  </span>
                </div>
                <BossHpBar raid={raid} size="md" />
              </div>
            </div>
          )}
        </button>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <RaidModal raid={raid} me={me} loggedIn={!!user} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  )
}

type RaidTab = 'combat' | 'rewards' | 'ranking' | 'rules'

// Encart de fin de raid : victoire avec les récompenses du joueur, ou défaite
function RaidResultCard({ raid, me }: { raid: RaidInfo; me: RaidMe }) {
  if (!raid.killed) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-center">
        <Skull size={28} className="mx-auto text-white/30" />
        <p className="text-white font-black mt-2">Le boss a survécu…</p>
        <p className="text-white/40 text-xs mt-1">Aucune récompense cette fois. Revanche au prochain raid !</p>
      </div>
    )
  }
  if (me.damage <= 0) {
    return (
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] px-4 py-5 text-center">
        <Trophy size={26} className="mx-auto text-yellow-300/60" />
        <p className="text-white font-black mt-2">Boss vaincu par la communauté !</p>
        <p className="text-white/40 text-xs mt-1">Tu n&apos;as pas participé à ce raid : rendez-vous au prochain.</p>
      </div>
    )
  }

  // Détail du calcul du mana : base du palier de rang × multiplicateur de dépassement
  const tier = me.rank ? raid.rankRewards.find(r => r.upToRank == null || me.rank! <= r.upToRank) : null
  const base = tier?.mana ?? 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.18), rgba(12,6,16,0) 70%), rgba(250,204,21,0.04)' }}>
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 text-yellow-300 font-black text-lg">
          <Trophy size={20} /> Boss vaincu !
        </p>
        <p className="text-white/50 text-xs mt-0.5">Tes récompenses ont été ajoutées à ton compte</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {/* Mana */}
        <div className="rounded-xl bg-black/30 border border-white/[0.08] p-3 flex flex-col items-center justify-center text-center">
          <Flame size={18} className="text-[#a78bfa]" />
          <p className="text-[#c4b5fd] font-black text-2xl tabular-nums leading-tight mt-1">+{fmt(me.manaReward ?? 0)}</p>
          <p className="text-white/60 text-xs font-bold">mana</p>
          {me.rank && (
            <p className="text-white/35 text-[10px] mt-1.5">
              #{me.rank} · {fmt(base)}{raid.multiplier > 1 && ` × ${raid.multiplier}`}
            </p>
          )}
        </div>

        {/* Carte promo */}
        <div className={cn('rounded-xl border p-3 flex flex-col items-center justify-center text-center',
          me.promoGranted ? 'bg-black/30 border-yellow-400/30' : 'bg-black/20 border-white/[0.06]')}>
          {raid.promo ? (
            <>
              <span className="mb-2 text-[8px] font-black uppercase tracking-[0.14em] text-yellow-300 whitespace-nowrap">Carte promotionnelle</span>
              <div className={cn(!me.promoGranted && 'grayscale opacity-40')}><PromoCard promo={raid.promo} size="sm" /></div>
              {me.promoGranted ? (
                <>
                  <p className="text-white font-black text-xs mt-2 truncate max-w-full">{raid.promo.name ?? 'Carte promo'}</p>
                </>
              ) : (
                <>
                  <p className="text-white/50 font-bold text-xs mt-2">Carte promo manquée</p>
                  <p className="text-white/35 text-[10px]">{me.missionDays}/{raid.requiredDays} jours de mission</p>
                </>
              )}
            </>
          ) : (
            <p className="text-white/30 text-xs">Pas de carte promo pour ce raid</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Une condition d'obtention de la carte promo : cochée (verte), impossible (rouge) ou en cours
function PromoCondition({ done, failed = false, children }: { done: boolean; failed?: boolean; children: React.ReactNode }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-[11px] leading-snug', done ? 'text-green-400' : failed ? 'text-red-400/80' : 'text-white/70')}>
      <span className={cn('mt-[1px] w-3.5 h-3.5 shrink-0 rounded-full border flex items-center justify-center',
        done ? 'bg-green-500/20 border-green-400' : failed ? 'border-red-400/60' : 'border-white/30')}>
        {done ? <Check size={9} /> : failed ? <X size={9} /> : null}
      </span>
      <span>{children}</span>
    </p>
  )
}

// Durée d'affichage des résultats (RAID_RESULTS_HOURS dans lib/game/raids.ts, module serveur)
const RAID_RESULTS_LABEL = '24 h'

// Libellés des paliers de rang : "1er", "2e – 3e", "4e – 10e", "Les autres"
function rankTierLabels(tiers: RaidInfo['rankRewards']) {
  let prev = 0
  return tiers.map(t => {
    const from = prev + 1
    const label = t.upToRank == null
      ? (prev ? 'Les autres participants' : 'Tous les participants')
      : t.upToRank === from
        ? (from === 1 ? '1er' : `${from}e`)
        : `${from === 1 ? '1er' : `${from}e`} – ${t.upToRank}e`
    if (t.upToRank != null) prev = t.upToRank
    return { label, mana: t.mana }
  })
}

// Onglet "Règles" : principe du raid avec les valeurs du raid en cours (dégâts, mana, multiplicateurs, assiduité)
function RaidRules({ raid }: { raid: RaidInfo }) {
  const v = raid.damageValues
  const days = raid.requiredDays
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <div className="space-y-3 text-[11px] leading-relaxed text-white/60">
          <div>
            <p className="text-white/85 font-bold mb-0.5">Le principe</p>
            <p>Toute la communauté attaque le même boss. Il faut faire tomber ses {fmt(raid.hp)} PV avant la fin du timer : chacun de tes gestes compte pour tout le monde.</p>
          </div>
          <div>
            <p className="text-white/85 font-bold mb-0.5">Infliger des dégâts</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><span className="text-red-300 font-bold">{v.booster}</span> dégât{v.booster > 1 ? 's' : ''} par booster ouvert</li>
              <li><span className="text-red-300 font-bold">{v.mission}</span> dégâts par mission quotidienne réclamée</li>
              <li><span className="text-red-300 font-bold">+{v.allMissions}</span> bonus quand les 3 missions du jour sont réclamées</li>
            </ul>
          </div>
          <div>
            <p className="text-white/85 font-bold mb-0.5">Mana selon ton classement</p>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
              {rankTierLabels(raid.rankRewards).map(t => (
                <div key={t.label} className="flex justify-between px-2.5 py-1">
                  <span>{t.label}</span>
                  <span className="text-[#c4b5fd] font-bold tabular-nums">{fmt(t.mana)} mana</span>
                </div>
              ))}
            </div>
            {raid.overkill.length > 0 && (
              <p className="mt-1.5">
                Bonus de dépassement : si la communauté inflige plus que les PV du boss, tout le mana est multiplié{' '}
                {raid.overkill.map((o, i) => (
                  <span key={o.ratio}>{i > 0 && (i === raid.overkill.length - 1 ? ' ou ' : ', ')}<span className="text-white/85 font-bold">×{o.multiplier}</span> à {Math.round(o.ratio * 100)} %</span>
                ))}.
              </p>
            )}
          </div>
          {raid.promo && (
            <div>
              <p className="text-white/85 font-bold mb-0.5">Carte promotionnelle</p>
              <p>
                Réclame au moins une mission quotidienne <span className="text-white/85 font-bold">chaque jour du raid</span> ({days} jour{days > 1 ? 's' : ''}).
                Si le boss tombe, la carte promo exclusive est à toi : elle rejoint ton profil, ne peut être ni recyclée ni échangée.
                Son image se dévoile au fil des PV perdus par le boss.
              </p>
            </div>
          )}
          <div>
            <p className="text-white/85 font-bold mb-0.5">Fin du raid</p>
            <p>
              Boss vaincu : les récompenses sont distribuées automatiquement à la fin du timer, rien à réclamer.
              Boss survivant : aucune récompense. Les résultats restent visibles {RAID_RESULTS_LABEL} après la fin.
            </p>
          </div>
        </div>
    </div>
  )
}

function RaidModal({ raid, me, loggedIn, onClose }: {
  raid: RaidInfo; me: RaidMe | null; loggedIn: boolean; onClose: () => void
}) {
  const [tab, setTab] = useState<RaidTab>('combat')
  const hpLeft = Math.max(0, raid.hp - raid.damage)
  const ratio = raid.damage / raid.hp
  // Carte promo = assiduité : au moins 1 mission réclamée chaque jour du raid
  const promoDays = promoDaysStatus(raid, me)
  const v = raid.damageValues
  const statusLabel = raid.phase === 'results' ? (raid.killed ? 'Raid réussi' : 'Raid échoué') : 'Raid en cours'

  const tabs: { id: RaidTab; label: string; icon: React.ReactNode }[] = [
    { id: 'combat',  label: 'Combat',      icon: <Swords size={13} /> },
    { id: 'rewards', label: 'Récompenses', icon: <Sparkles size={13} /> },
    { id: 'ranking', label: 'Classement',  icon: <Trophy size={13} /> },
    { id: 'rules',   label: 'Règles',      icon: <BookOpen size={13} /> },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        // Taille fixe : la fenêtre ne change pas de hauteur d'un onglet à l'autre (le contenu défile)
        className="w-full sm:w-[480px] h-[min(680px,92vh)] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0c0610] border border-red-500/25 overflow-hidden shadow-[0_0_60px_rgba(239,68,68,0.15)]">

        {/* ── Le boss, en entier ── */}
        <div className="relative shrink-0 h-60 sm:h-72 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 85%, rgba(239,68,68,0.35) 0%, rgba(80,10,25,0.35) 45%, #0c0610 75%)' }}>
          {raid.bossImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={raid.bossImageUrl} alt={raid.bossName} draggable={false}
              className={cn('absolute inset-x-0 bottom-6 mx-auto h-[calc(100%-2.75rem)] w-auto max-w-[90%] object-contain object-bottom select-none',
                raid.killed ? 'grayscale brightness-50' : 'boss-glow')} />
          ) : (
            <div className="absolute inset-x-0 bottom-20 flex justify-center"><Skull size={64} className="text-red-400 boss-glow" /></div>
          )}
          {raid.killed && (
            <div className="absolute inset-x-0 bottom-24 flex justify-center"><Skull size={44} className="text-yellow-300 drop-shadow-lg" /></div>
          )}

          {/* Haut : statut + timer + fermer */}
          <div className="absolute top-3 left-4 right-3 flex items-center gap-2">
            {/* Deux pastilles de même gabarit : même hauteur, même padding, même taille de texte */}
            <span className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-black/50 backdrop-blur-sm text-[11px] font-black tracking-wide text-red-300 uppercase leading-none">
              <Swords size={11} /> {statusLabel}
            </span>
            {raid.phase === 'running' && (
              <span className="h-7 inline-flex items-center px-2.5 rounded-lg bg-black/50 backdrop-blur-sm text-[11px] font-bold leading-none">
                <RaidTimer endsAt={raid.endsAt} prefix="fin dans" />
              </span>
            )}
            <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white"><X size={16} /></button>
          </div>

          {/* Bas : nom + PV */}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-3 pt-8" style={{ background: 'linear-gradient(to top, #0c0610 35%, transparent)' }}>
            <div className="flex items-end justify-between gap-3 mb-1.5">
              <h3 className="text-white font-black text-2xl leading-none truncate">{raid.bossName}</h3>
              <span className="shrink-0 text-xs font-bold tabular-nums">
                {raid.killed
                  ? <span className="text-yellow-300 flex items-center gap-1"><Skull size={12} /> Vaincu · {Math.round(ratio * 100)} %</span>
                  : <span className="text-red-300 flex items-center gap-1"><Heart size={12} /> {fmt(hpLeft)} / {fmt(raid.hp)}</span>}
              </span>
            </div>
            <BossHpBar raid={raid} />
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="shrink-0 flex gap-1 mx-4 mt-3 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              // 4 onglets : largeur selon le libellé (pas de texte coupé), icône seule sur très petit écran
              className={cn('flex-auto flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                tab === t.id ? 'bg-red-500/20 text-red-200' : 'text-white/40 hover:text-white/70')}>
              {t.icon}<span className="hidden min-[400px]:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-5 space-y-4">

          {/* ── Combat ── */}
          {tab === 'combat' && <>
            {raid.description && <p className="text-white/50 text-xs italic text-center">« {raid.description} »</p>}

            {/* Résultat personnel (après distribution) */}
            {raid.phase === 'results' && loggedIn && me && <RaidResultCard raid={raid} me={me} />}

            {/* Mes stats */}
            {loggedIn ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-red-300 font-black text-xl tabular-nums">{fmt(me?.damage ?? 0)}</p><p className="text-white/40 text-[10px] uppercase tracking-wide">Mes dégâts</p></div>
                  <div><p className="text-white font-black text-xl tabular-nums">{me?.rank ? `#${me.rank}` : '-'}</p><p className="text-white/40 text-[10px] uppercase tracking-wide">Classement</p></div>
                  <div>
                    <p className={cn('font-black text-xl tabular-nums', promoDays.eligible ? 'text-green-400' : 'text-white')}>
                      {promoDays.days}<span className="text-white/30 text-sm">/{promoDays.required}</span>
                    </p>
                    <p className="text-white/40 text-[10px] uppercase tracking-wide">Jours de mission</p>
                  </div>
                </div>
                {raid.phase === 'running' && raid.promo && (
                  <p className={cn('mt-3 pt-3 border-t border-white/[0.06] text-xs text-center',
                    promoDays.eligible ? 'text-green-400' : !promoDays.possible ? 'text-red-400/80' : promoDays.doneToday ? 'text-green-400/80' : 'text-yellow-200/80')}>
                    {promoDays.eligible
                      ? raid.killed
                        ? 'Boss vaincu et une mission chaque jour : la carte promo est à toi ! Elle arrivera dans ton profil à la fin du raid.'
                        : 'Une mission chaque jour : la carte promo est à toi si le boss tombe !'
                      : !promoDays.possible
                        ? 'Trop de jours manqués pour la carte promo, mais tes dégâts comptent toujours pour le mana.'
                        : promoDays.doneToday
                          ? 'Mission du jour faite. Reviens demain pour garder ta série !'
                          : 'Réclame une mission quotidienne aujourd\'hui pour garder ta série vers la carte promo.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-white/50 text-sm">Connecte-toi pour attaquer le boss.</p>
            )}

            {/* Comment infliger des dégâts */}
            {raid.phase === 'running' && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Infliger des dégâts</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { value: v.booster,          label: 'par booster ouvert' },
                    { value: v.mission,          label: 'par mission réclamée' },
                    { value: `+${v.allMissions}`, label: 'les 3 missions du jour' },
                  ].map(x => (
                    <div key={x.label} className="rounded-xl bg-red-500/[0.06] border border-red-500/15 py-2 px-1">
                      <p className="text-red-300 font-black text-base">{x.value}</p>
                      <p className="text-white/50 text-[10px] leading-tight">{x.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/40 text-center">Aidez-vous : chaque mission réussie rapproche tout le monde de la victoire.</p>
              </div>
            )}
          </>}

          {/* ── Règles ── */}
          {tab === 'rules' && <RaidRules raid={raid} />}

          {/* ── Récompenses ── */}
          {tab === 'rewards' && <>
            {raid.promo && (
              <div className="flex gap-4 items-center rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-3">
                {/* Mini-titre au-dessus de la carte */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <PromoCard promo={raid.promo} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1"><Sparkles size={12} /> Carte promo</p>
                  <p className="text-white font-black">{raid.promo.name ?? '???'}</p>
                  <p className="text-white/40 text-[11px]">
                    {raid.promo.name ? 'Révélée !' : `${puzzleRevealedCount(raid.promo.reveal)}/${PUZZLE_TILES} cases dévoilées, au fil des PV perdus par le boss.`}
                  </p>
                  {/* Conditions d'obtention, cochées quand elles sont remplies */}
                  <div className="pt-1 space-y-1">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold">Pour la gagner</p>
                    <PromoCondition done={raid.killed}>Le boss est vaincu</PromoCondition>
                    <PromoCondition done={promoDays.eligible} failed={loggedIn && !promoDays.possible}>
                      1 mission quotidienne réclamée <strong className="text-white">chaque jour</strong> du raid
                      {loggedIn && <span className="text-white/40"> ({promoDays.days}/{promoDays.required} jours)</span>}
                      {!loggedIn && <span className="text-white/40"> ({promoDays.required} jours)</span>}
                    </PromoCondition>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Mana selon ton classement (si vaincu)</p>
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] text-xs">
                {raid.rankRewards.map((r, i) => {
                  const from = i === 0 ? 1 : (raid.rankRewards[i - 1].upToRank ?? 0) + 1
                  const label = r.upToRank == null ? (i === 0 ? 'Tous les participants' : 'Autres participants')
                    : from === r.upToRank ? `#${r.upToRank}` : `#${from} à #${r.upToRank}`
                  return (
                    <div key={i} className="flex justify-between px-3 py-2">
                      <span className="text-white/60">{label}</span>
                      <span className="text-[#c4b5fd] font-bold tabular-nums">{fmt(r.mana)} mana</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {raid.overkill.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1"><Flame size={12} /> Bonus de dépassement des PV</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {raid.overkill.map((o, i) => {
                    const reached = ratio >= o.ratio
                    return (
                      <div key={i} className={cn('rounded-xl border py-2', reached ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/[0.06]')}>
                        <p className={cn('font-black', reached ? 'text-yellow-300' : 'text-white/70')}>×{o.multiplier}</p>
                        <p className="text-white/40 text-[10px]">à {Math.round(o.ratio * 100)} % des PV</p>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-white/40 text-center">
                  {raid.killed && raid.multiplier > 1 ? `Multiplicateur actuel : ×${raid.multiplier} sur tout le mana.` : 'Continuez à frapper après sa mort pour multiplier le mana de tout le monde.'}
                </p>
              </div>
            )}
          </>}

          {/* ── Classement ── */}
          {tab === 'ranking' && (
            raid.leaderboard.length === 0
              ? <p className="text-center text-white/40 text-sm py-8">Personne n&apos;a encore attaqué le boss. À toi de jouer !</p>
              : <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] text-sm">
                  {raid.leaderboard.map(l => (
                    <div key={l.rank} className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-7 font-black tabular-nums', l.rank === 1 ? 'text-yellow-300' : l.rank <= 3 ? 'text-orange-300' : 'text-white/40')}>#{l.rank}</span>
                        <span className="text-white/85 truncate">{l.username}</span>
                      </span>
                      <span className="text-red-300 font-bold tabular-nums">{fmt(l.damage)}</span>
                    </div>
                  ))}
                </div>
          )}
          {tab === 'ranking' && loggedIn && me?.rank && me.rank > raid.leaderboard.length && (
            <p className="text-center text-white/50 text-xs">Toi : #{me.rank} avec {fmt(me.damage)} dégâts</p>
          )}
        </div>
      </div>
    </div>
  )
}

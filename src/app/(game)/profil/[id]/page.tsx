'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, Lock, UserPlus, Check, Clock, ArrowLeft, Gem, Sword, Shield, Flame } from 'lucide-react'
import { CardMedia } from '@/components/game/CardMedia'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
import { FavoriteShowcase } from '@/components/game/FavoriteShowcase'
import { RoleBadge } from '@/components/game/RoleBadge'
import { AvatarRing } from '@/components/game/AvatarRing'
import { cn } from '@/lib/utils'

const RARITY_ORDER = ['void','legendary','epic','rare','uncommon','common']
const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}

function xpForLevel(lvl: number) { return Math.floor(200 * Math.pow(1.18, lvl - 1)) }
function getLevelProgress(xp: number, level: number) {
  let cumulative = 0
  for (let i = 1; i < level; i++) cumulative += xpForLevel(i)
  const needed = xpForLevel(level)
  const inLevel = xp - cumulative
  return { current: Math.max(0, inLevel), needed, progress: Math.min(100, Math.max(0, Math.round((inLevel / needed) * 100))) }
}

interface GroupedCard {
  card_id: string
  rarity: string
  family: string
  count: number
  name: string
  image_url: string | null
  description: string | null
  cost: number | null
  atk: number | null
  def: number | null
  owned: boolean
  artist: string | null
  artistUrl: string | null
}

interface PlayerProfile {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
  xp: number
  highestRarity: string | null
  currentStreak: number
}

interface Friendship { status: string; friendshipId: number | null }

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()

  const [profile, setProfile]     = useState<PlayerProfile | null>(null)
  const [isSelf, setIsSelf]       = useState(false)
  const [friendship, setFriendship] = useState<Friendship>({ status: 'none', friendshipId: null })
  const [cards, setCards]         = useState<GroupedCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [selected, setSelected]   = useState<GroupedCard | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy]           = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const toggleSection = (r: string) => setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const playerRes = await fetch(`/api/players/${id}`)
    if (!playerRes.ok) { setNotFound(true); setLoading(false); return }
    const player = await playerRes.json()

    const [cardDefs, _fam] = await Promise.all([
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
      fetch('/api/families').then(r => r.ok ? r.json() : []),
    ])

    setProfile(player.profile)
    setIsSelf(player.isSelf)
    setFriendship(player.friendship ?? { status: 'none', friendshipId: null })

    const defMap: Record<string, { name: string; image_url: string | null; description: string | null; cost: number | null; atk: number | null; def: number | null; artist: string | null; artistUrl: string | null }> = {}
    for (const d of cardDefs ?? []) {
      const meta = typeof d.metadata === 'string' ? (() => { try { return JSON.parse(d.metadata || '{}') } catch { return {} } })() : (d.metadata ?? {})
      defMap[d.id] = {
        name: d.name,
        image_url: d.imageUrl ?? d.image_url,
        description: d.description ?? null,
        cost: meta?.combat?.cost ?? null,
        atk:  meta?.combat?.atk  ?? null,
        def:  meta?.combat?.hp   ?? null,
        artist: d.artist ?? null,
        artistUrl: d.artistUrl ?? d.artist_url ?? null,
      }
    }

    const ownedList: GroupedCard[] = (player.collection ?? []).map((c: { cardId?: string; card_id?: string; rarity: string; family: string; count?: number }) => {
      const cardKey = c.cardId ?? c.card_id ?? ''
      const def = defMap[cardKey]
      return {
        card_id: cardKey, rarity: c.rarity, family: c.family, count: c.count ?? 1,
        name: def?.name ?? cardKey, image_url: def?.image_url ?? null, description: def?.description ?? null,
        cost: def?.cost ?? null, atk: def?.atk ?? null, def: def?.def ?? null,
        owned: true, artist: def?.artist ?? null, artistUrl: def?.artistUrl ?? null,
      }
    })

    const ownedIds = new Set(ownedList.map(c => c.card_id))
    const lockedList: GroupedCard[] = (cardDefs ?? [])
      .filter((d: { id: string }) => !ownedIds.has(d.id))
      .map((d: { id: string; name?: string; rarity?: string; family?: string; familyKey?: string }) => {
        const def = defMap[d.id]
        return {
          card_id: d.id, rarity: d.rarity ?? 'common', family: d.family ?? d.familyKey ?? '', count: 0,
          name: def?.name ?? d.name ?? d.id, image_url: def?.image_url ?? null, description: def?.description ?? null,
          cost: def?.cost ?? null, atk: def?.atk ?? null, def: def?.def ?? null,
          owned: false, artist: def?.artist ?? null, artistUrl: def?.artistUrl ?? null,
        }
      })

    const sorted = [...ownedList, ...lockedList].sort((a, b) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      return ri !== 0 ? ri : a.name.localeCompare(b.name)
    })

    setCards(sorted)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function refreshFriendship() {
    const res = await fetch(`/api/players/${id}`)
    if (res.ok) { const p = await res.json(); setFriendship(p.friendship ?? { status: 'none', friendshipId: null }) }
  }

  async function addFriend() {
    setBusy(true)
    await fetch('/api/social/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: id }) })
    await refreshFriendship(); setBusy(false)
  }
  async function acceptFriend() {
    if (!friendship.friendshipId) return
    setBusy(true)
    await fetch('/api/social/friends', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendshipId: friendship.friendshipId, accept: true }) })
    await refreshFriendship(); setBusy(false)
  }
  async function removeFriend() {
    if (!friendship.friendshipId) return
    setBusy(true)
    await fetch('/api/social/friends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendshipId: friendship.friendshipId }) })
    await refreshFriendship(); setBusy(false)
  }

  const owned       = cards.filter(c => c.owned)
  const totalCards  = owned.reduce((a, c) => a + c.count, 0)
  const uniqueCards = owned.length
  const byRarity: Record<string, number> = {}
  for (const c of owned) byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + c.count

  const rarityGroups = RARITY_ORDER.filter(r => cards.some(c => c.rarity === r))
  const level = profile?.level ?? 1
  const { current: xpCurrent, needed: xpNeeded, progress } = getLevelProgress(profile?.xp ?? 0, level)
  const totalAvailable = cards.length
  const isComplete = totalAvailable > 0 && uniqueCards === totalAvailable

  function FriendButton() {
    if (isSelf || !profile) return null
    const s = friendship.status
    if (s === 'accepted') return (
      <div className="relative flex-shrink-0">
        <button onClick={() => setConfirmRemove(true)} disabled={busy}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#00c896]/15 border border-[#00c896]/40 text-[#00c896] hover:bg-[#00c896]/25 transition-colors disabled:opacity-50">
          <Check size={12} /> Amis
        </button>
        {confirmRemove && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setConfirmRemove(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl border border-white/[0.1] p-4 w-52 shadow-2xl"
            style={{ background: 'rgba(10,6,18,0.97)', backdropFilter: 'blur(16px)' }}>
            <p className="text-white font-bold text-sm mb-1">Retirer cet ami ?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRemove(false)}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-white/[0.1] transition-colors">
                Annuler
              </button>
              <button onClick={async () => { setConfirmRemove(false); await removeFriend() }}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.2)')}>
                Retirer
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    )
    if (s === 'pending_sent') return (
      <button disabled
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white/5 border border-white/10 text-white/40 flex-shrink-0">
        <Clock size={12} /> Envoyé
      </button>
    )
    if (s === 'pending_received') return (
      <button onClick={acceptFriend} disabled={busy}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35 transition-colors disabled:opacity-50 flex-shrink-0">
        <Check size={12} /> Accepter
      </button>
    )
    return (
      <button onClick={addFriend} disabled={busy}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35 transition-colors disabled:opacity-50 flex-shrink-0">
        <UserPlus size={12} /> Ajouter
      </button>
    )
  }

  if (notFound) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <p className="text-white/40 text-sm">Joueur introuvable.</p>
      <button onClick={() => router.back()} className="text-[#a78bfa] text-xs font-bold">← Retour</button>
    </div>
  )

  return (
    <div className="pb-4 max-w-5xl mx-auto w-full">
      <div className="sticky top-20 z-20 mb-6 rounded-2xl border border-white/[0.07] px-4 pt-3 pb-3 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(8,10,18,0.88)' }}>

        {/* Ligne 1 : retour + ami */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background='rgba(255,255,255,0.09)'; b.style.color='rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background='rgba(255,255,255,0.05)'; b.style.color='rgba(255,255,255,0.4)' }}>
            <ArrowLeft size={13} />
          </button>
          <FriendButton />
        </div>

        {/* Ligne 2 : avatar + infos + XP */}
        <div className="flex items-center gap-3">
          <AvatarRing
            avatarUrl={profile?.avatarUrl}
            username={profile?.username}
            size={50}
            xpProgress={progress}
            isComplete={isComplete}
          />

          {/* Nom + niveau + streak */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="text-white font-black text-sm truncate leading-tight">{profile?.username ?? '…'}</p>
              <RoleBadge role={(profile as unknown as { role?: string } | null)?.role as 'founder' | 'developer' | 'artist' | 'streamer' | null} />
              {profile?.highestRarity && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold capitalize flex-shrink-0"
                  style={{ background: RARITY_COLOR[profile.highestRarity]+'20', color: RARITY_COLOR[profile.highestRarity] }}>
                  {profile.highestRarity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[#a78bfa] text-xs font-bold">Niv. {level}</p>
              {(profile?.currentStreak ?? 0) > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,154,61,0.12)', border: '1px solid rgba(255,154,61,0.22)' }}>
                  <Flame size={9} style={{ color: '#ff9a3d' }} />
                  <span className="text-[9px] font-black" style={{ color: '#ff9a3d' }}>{profile!.currentStreak}j</span>
                </div>
              )}
            </div>
          </div>

          {/* XP droite */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[80px]">
            <div className="flex items-baseline gap-1">
              <span className="text-white font-black text-sm leading-none">{xpCurrent.toLocaleString('fr-FR')}</span>
              <span className="text-white/30 text-[10px]">XP</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${progress}%`, background:'linear-gradient(90deg,#7b2bff,#a855f7)' }} />
            </div>
            <span className="text-white/20 text-[9px]">/ {xpNeeded.toLocaleString('fr-FR')} XP</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Collection</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-white font-black text-xl">{totalCards}</p>
                <p className="text-white/40 text-xs">Cartes total</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-white font-black text-xl">{uniqueCards}</p>
                <p className="text-white/40 text-xs">Uniques</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {RARITY_ORDER.filter(r => byRarity[r]).map(r => (
                <div key={r} className="flex-1 rounded-xl px-2 py-2.5 flex flex-col items-center gap-1"
                  style={{ background: `${RARITY_COLOR[r]}12`, border: `1px solid ${RARITY_COLOR[r]}28` }}>
                  <span className="text-white font-black text-sm leading-none">{byRarity[r]}</span>
                  <span className="text-[10px] font-bold capitalize leading-none" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vitrine (favoris) */}
          <FavoriteShowcase
            className="mb-6"
            favoriteIds={(profile as unknown as { favoriteCards?: string[] }).favoriteCards ?? []}
          />

          {/* Album */}
          <div className="space-y-6">
            {rarityGroups.map(r => {
              const group = cards.filter(c => c.rarity === r)
              if (!group.length) return null
              const isOpen = !collapsed[r]
              return (
                <div key={r}>
                  <button onClick={() => toggleSection(r)} className="flex items-center gap-2 mb-3 w-full">
                    <ChevronDown size={14} className="transition-transform duration-300 shrink-0"
                      style={{ color: RARITY_COLOR[r], transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                    <div className="flex-1 h-px" style={{ background: RARITY_COLOR[r] + '30' }} />
                    <span className="text-white/30 text-xs">{group.filter(c => c.owned).length}/{group.length}</span>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-8">
                        {group.map(card => (
                          !card.owned ? (
                            <div key={card.card_id} className="flex flex-col">
                              <div className="relative rounded-[12px] overflow-hidden border border-white/[0.06] bg-black/40" style={{ aspectRatio: '0.714' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/assets/dos.png" alt="" draggable={false} className="w-full h-full object-cover select-none" style={{ filter: 'grayscale(1) brightness(0.32) contrast(0.9)' }} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
                                  <Lock size={22} className="text-white/45" />
                                  <span className="text-white/75 text-[11px] font-bold leading-tight line-clamp-2 uppercase">{card.name}</span>
                                  <span className="text-white/35 text-[8px] font-bold uppercase tracking-widest">Non possédée</span>
                                </div>
                              </div>
                              <div className="min-h-[30px]" />
                            </div>
                          ) : (
                            <div key={card.card_id} className="flex flex-col">
                            <CardHover rarity={card.rarity} className="relative cursor-pointer active:scale-95" style={{ aspectRatio: '0.714', overflow: 'visible' }}>
                              <CardFrame rarity={card.rarity} name={card.name} cost={card.cost} atk={card.atk} def={card.def} glow={false} hideStats style={{ position: 'absolute', inset: 0 }}>
                                <button onClick={() => setSelected(card)} className="absolute inset-0 w-full h-full">
                                  {card.image_url ? (
                                    <CardMedia src={card.image_url} alt={card.name} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-12 h-12 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}, transparent)` }} />
                                    </div>
                                  )}
                                </button>
                              </CardFrame>
                              {card.count > 1 && (
                                <div className="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-black/80 border-2 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                  style={{ borderColor: RARITY_COLOR[card.rarity] + '66', boxShadow: `0 0 8px ${RARITY_COLOR[card.rarity]}66` }}>
                                  {card.count}
                                </div>
                              )}
                              <div className="absolute left-0 right-0 flex items-center justify-center gap-1" style={{ top: '100%', marginTop: 6 }}>
                                {card.cost != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border text-white/80"
                                    style={{ borderColor: RARITY_COLOR[card.rarity] + '55' }} title="Coût">
                                    <Gem size={11} style={{ color: RARITY_COLOR[card.rarity] }} />{card.cost}
                                  </span>
                                )}
                                {card.atk != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border border-white/10 text-white/80" title="Attaque">
                                    <Sword size={11} className="text-rose-300/90" />{card.atk}
                                  </span>
                                )}
                                {card.def != null && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-white/[0.05] border border-white/10 text-white/80" title="Défense">
                                    <Shield size={11} className="text-sky-300/90" />{card.def}
                                  </span>
                                )}
                              </div>
                            </CardHover>
                            <div className="min-h-[30px]" />
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selected && (
        <CardModal
          name={selected.name}
          rarity={selected.rarity}
          family={selected.family}
          artUrl={selected.image_url}
          description={selected.description}
          artist={selected.artist}
          artistUrl={selected.artistUrl}
          count={selected.count}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

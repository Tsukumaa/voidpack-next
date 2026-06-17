'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, Lock, UserPlus, Check, Clock, ArrowLeft } from 'lucide-react'
import { CardMedia } from '@/components/game/CardMedia'
import { CardModal } from '@/components/game/CardModal'
import { CardHover } from '@/components/game/CardHover'
import { CardFrame } from '@/components/game/CardFrame'
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

  function FriendButton() {
    if (isSelf || !profile) return null
    const s = friendship.status
    if (s === 'accepted') return (
      <button onClick={removeFriend} disabled={busy}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#00c896]/15 border border-[#00c896]/40 text-[#00c896] hover:bg-[#00c896]/25 transition-colors disabled:opacity-50">
        <Check size={14} /> Amis
      </button>
    )
    if (s === 'pending_sent') return (
      <button disabled
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-white/40">
        <Clock size={14} /> En attente
      </button>
    )
    if (s === 'pending_received') return (
      <button onClick={acceptFriend} disabled={busy}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35 transition-colors disabled:opacity-50">
        <Check size={14} /> Accepter la demande
      </button>
    )
    return (
      <button onClick={addFriend} disabled={busy}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#7b2bff]/20 border border-[#7b2bff]/40 text-[#a78bfa] hover:bg-[#7b2bff]/35 transition-colors disabled:opacity-50">
        <UserPlus size={14} /> Ajouter
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
    <div className="pb-4">
      <div className="sticky top-20 z-20 py-4 mb-6 backdrop-blur-md rounded-xl px-4" style={{ backgroundColor: 'rgba(8,10,18,0.82)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs font-bold mb-3 transition-colors">
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="flex items-center gap-3">
          <div className="relative rounded-full p-[2px] shrink-0"
            style={{ background: `conic-gradient(from -90deg, #00c896, #7b2bff ${progress}%, rgba(255,255,255,0.08) ${progress}%)` }}>
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#0a0612] flex items-center justify-center">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white">{profile?.username?.[0]?.toUpperCase() ?? '?'}</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg truncate">{profile?.username ?? '…'}</p>
            <p className="text-[#a78bfa] text-xs font-bold">Niveau {level}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{xpCurrent.toLocaleString('fr-FR')} / {xpNeeded.toLocaleString('fr-FR')} XP</p>
          </div>

          <FriendButton />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Collection</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                <p className="text-white font-black text-xl">{totalCards}</p>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Cartes</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                <p className="text-white font-black text-xl">{uniqueCards}</p>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Uniques</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {RARITY_ORDER.filter(r => byRarity[r]).map(r => (
                <div key={r} className="flex items-center gap-2">
                  <span className="capitalize text-[10px] font-bold w-16 shrink-0" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(byRarity[r] / Math.max(1, totalCards)) * 100}%`, background: RARITY_COLOR[r] }} />
                  </div>
                  <span className="text-white/40 text-xs w-6 text-right">{byRarity[r]}</span>
                </div>
              ))}
            </div>
          </div>

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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-5">
                        {group.map(card => (
                          !card.owned ? (
                            <div key={card.card_id} className="relative rounded-[12px] overflow-hidden border border-white/[0.06] bg-black/40" style={{ aspectRatio: '0.714' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/assets/dos.png" alt="" draggable={false} className="w-full h-full object-cover select-none" style={{ filter: 'grayscale(1) brightness(0.32) contrast(0.9)' }} />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                <Lock size={24} className="text-white/50" />
                                <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Non possédée</span>
                              </div>
                            </div>
                          ) : (
                            <CardHover key={card.card_id} rarity={card.rarity} className="relative cursor-pointer active:scale-95" style={{ aspectRatio: '0.714' }}>
                              <CardFrame rarity={card.rarity} name={card.name} cost={card.cost} atk={card.atk} def={card.def} glow={false} style={{ position: 'absolute', inset: 0 }}>
                                <button onClick={() => setSelected(card)} className="absolute inset-0 w-full h-full">
                                  {card.image_url ? (
                                    <CardMedia src={card.image_url} alt={card.name} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-12 h-12 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}, transparent)` }} />
                                    </div>
                                  )}
                                </button>
                                {card.count > 1 && (
                                  <div className="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-black/60 border-2 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                    style={{ borderColor: RARITY_COLOR[card.rarity] + '66', boxShadow: `0 0 8px ${RARITY_COLOR[card.rarity]}66` }}>
                                    {card.count}
                                  </div>
                                )}
                              </CardFrame>
                            </CardHover>
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

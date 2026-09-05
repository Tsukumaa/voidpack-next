'use client'
import { Users, Search, X, Medal, BookOpen, Hexagon, Check, Swords, Sword, UserPlus, Clock, ArrowLeftRight, Plus, Link as LinkIcon, Eye, Package } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game'
import { StatePanel } from '@/components/game/StatePanel'
import { RoleBadge, SubscriberBadge, type UserRole } from '@/components/game/RoleBadge'
import { AvatarRing } from '@/components/game/AvatarRing'
import { useSocialStore } from '@/store/social'
import { FeatureGate } from '@/components/FeatureGate'
import { cn } from '@/lib/utils'
import { CombatRulesModal } from '@/components/game/CombatRulesModal'
import { useCards } from '@/hooks/useCards'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LadderEntry {
  user_id: string
  username: string | null
  avatar_url: string | null
  xp: number
  level: number
  unique_cards: number
  void_cards: number
  highest_rarity: string | null
  role: UserRole
  collectionComplete?: boolean
  is_subscriber?: boolean
  wins?: number
  losses?: number
  rankPoints?: number
  currentStreak?: number
  bestStreak?: number
  packsOpened?: number
  totalCards?: number
}

interface Friend {
  id: number
  friend_id: string
  username: string | null
  avatar_url: string | null
  status: string
  collectionComplete?: boolean
  activeSessionId?: string | null
  is_subscriber?: boolean
}

interface Trade {
  id: string
  senderId: string
  receiverId: string
  senderUsername: string
  senderAvatarUrl: string | null
  receiverUsername: string
  receiverAvatarUrl: string | null
  offeredCardKey: string
  offeredRarity: string
  wantedCardKey: string
  wantedCardName: string | null
  wantedRarity: string | null
  message: string | null
  status: string
  createdAt: string
  expiresAt: string | null
}

interface MarketOffer {
  id: string
  sellerId: string
  sellerUsername: string
  sellerAvatarUrl: string | null
  offeredCardKey: string
  offeredRarity: string
  wantedCardKey: string
  wantedCardName: string | null
  wantedRarity: string | null
  message: string | null
  status: string
  createdAt: string
  expiresAt: string | null
}

interface MyCard {
  cardId: string
  rarity: string
  family: string
  count: number
  name: string
  image_url: string | null
}

interface SimpleFriend {
  friend_id: string
  username: string | null
  avatar_url: string | null
}

interface AllCard {
  id: string
  name: string
  rarity: string
  image_url: string | null
}

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}
const RARITY_LABEL: Record<string, string> = {
  void: 'VOID', legendary: 'Légendaire', epic: 'Épique', rare: 'Rare', common: 'Commun',
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function RarityBadge({ rarity }: { rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
      style={{ color, background: color + '20' }}>
      {RARITY_LABEL[rarity] ?? rarity}
    </span>
  )
}

function CardThumb({ name, imageUrl, rarity }: { name: string; imageUrl?: string | null; rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-10 rounded flex-shrink-0 overflow-hidden border"
        style={{ borderColor: color + '60', background: '#0a0816' }}>
        {imageUrl
          ? <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[8px] text-white/20">?</div>
        }
      </div>
      <div>
        <p className="text-white text-xs font-bold truncate max-w-[120px] uppercase">{name}</p>
        <RarityBadge rarity={rarity} />
      </div>
    </div>
  )
}

// ── Modal création de trade ───────────────────────────────────────────────────
// Flux normal : friend → want (collection ami) → offer (mes cartes) → confirm
// Flux marché : want (toutes cartes) → offer (mes cartes) → confirm
function CreateTradeModal({ onClose, onCreated, marketMode = false }: { onClose: () => void; onCreated: () => void; marketMode?: boolean }) {
  const firstStep = marketMode ? 'want' : 'friend'
  const { fetchCards }              = useCards()
  const [step, setStep]             = useState<'friend' | 'want' | 'offer' | 'confirm'>(firstStep)
  const [myCards, setMyCards]       = useState<MyCard[]>([])
  const [allCards, setAllCards]     = useState<AllCard[]>([])
  const [friendCards, setFriendCards] = useState<AllCard[]>([])
  const [loadingFriend, setLoadingFriend] = useState(false)
  const [friends, setFriends]       = useState<SimpleFriend[]>([])
  const [search, setSearch]         = useState('')
  const [offered, setOffered]       = useState<MyCard | null>(null)
  const [wanted, setWanted]         = useState<AllCard | null>(null)
  const [receiver, setReceiver]     = useState<SimpleFriend | null>(null)
  const [message, setMessage]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetchCards(),
      ...(marketMode ? [] : [fetch('/api/social/friends').then(r => r.ok ? r.json() : [])]),
    ]).then(([col, cards, fr]) => {
      const defs: Record<string, AllCard> = {}
      for (const c of cards ?? []) {
        const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
        defs[c.id] = { id: c.id, name: c.name, rarity: c.rarity ?? 'common', image_url: c.imageUrl ?? c.image_url ?? meta?.image_url ?? null }
      }
      setAllCards(Object.values(defs))
      setMyCards((col ?? []).map((c: { cardId?: string; card_id?: string; rarity: string; family: string; count: number }) => {
        const key = c.cardId ?? c.card_id ?? ''
        const def = defs[key]
        return { cardId: key, rarity: c.rarity, family: c.family, count: c.count, name: def?.name ?? key, image_url: def?.image_url ?? null }
      }).filter((c: MyCard) => c.count >= 1))
      if (!marketMode && fr) {
        setFriends((fr ?? []).map((f: Record<string, unknown>) => ({
          friend_id: f.userId ?? f.friend_id,
          username: f.username ?? null,
          avatar_url: f.avatarUrl ?? f.avatar_url ?? null,
        })))
      }
    })
  }, [marketMode])

  async function selectFriend(f: SimpleFriend) {
    setReceiver(f)
    setSearch('')
    setLoadingFriend(true)
    try {
      const [col, cards] = await Promise.all([
        fetch(`/api/collection?userId=${f.friend_id}`).then(r => r.ok ? r.json() : []),
        fetchCards(),
      ])
      const defs: Record<string, AllCard> = {}
      for (const c of cards ?? []) {
        const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
        defs[c.id] = { id: c.id, name: c.name, rarity: c.rarity ?? 'common', image_url: c.imageUrl ?? c.image_url ?? meta?.image_url ?? null }
      }
      const fc = (col ?? []).map((c: { cardId?: string; card_id?: string; rarity: string; count: number }) => {
        const key = c.cardId ?? c.card_id ?? ''
        return { ...defs[key], id: key, rarity: c.rarity }
      }).filter((c: AllCard) => c.id && c.name)
      setFriendCards(fc)
    } finally {
      setLoadingFriend(false)
      setStep('want')
    }
  }

  async function submit() {
    if (!offered || !wanted) return
    if (!marketMode && !receiver) return
    setSaving(true); setError('')
    try {
      const endpoint = marketMode ? '/api/market' : '/api/trade'
      const body = marketMode
        ? { offeredCardKey: offered.cardId, offeredRarity: offered.rarity, wantedCardKey: wanted.id, wantedCardName: wanted.name, wantedRarity: wanted.rarity, message: message || null }
        : { receiverId: receiver!.friend_id, offeredCardKey: offered.cardId, offeredRarity: offered.rarity, wantedCardKey: wanted.id, wantedCardName: wanted.name, wantedRarity: wanted.rarity, message: message || null }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      onCreated()
    } catch { setError('Erreur réseau') }
    finally { setSaving(false) }
  }

  const normalSteps = ['friend', 'want', 'offer', 'confirm'] as const
  const marketSteps = ['want', 'offer', 'confirm'] as const
  const steps = marketMode ? marketSteps : normalSteps

  const stepLabel: Record<string, string> = {
    friend: 'Choisir un joueur',
    want: receiver ? `Collection de ${receiver.username}` : 'Carte voulue',
    offer: 'Ta carte à offrir',
    confirm: 'Confirmer',
  }

  const wantList = (marketMode ? allCards : friendCards)
    .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))

  const offerList = myCards
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[500px] max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">

        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <h3 className="text-white font-black flex items-center gap-2"><ArrowLeftRight size={16} /> {marketMode ? 'Publier une offre' : 'Proposer un trade'}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-1 px-5 py-3 flex-shrink-0">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn('w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all',
                step === s ? 'bg-[#7b2bff] text-white' : (steps.indexOf(step as 'want' | 'offer' | 'confirm') > i ? 'bg-[#7b2bff]/40 text-white/60' : 'bg-white/5 text-white/30'))}>
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-white/40">{stepLabel[step]}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Étape 1 (normal) : choisir un ami */}
          {step === 'friend' && (
            <div className="px-4 pb-4 space-y-2">
              {friends.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucun ami — ajoute des amis d&apos;abord</p>}
              {friends.map(f => (
                <button key={f.friend_id} onClick={() => selectFriend(f)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                    receiver?.friend_id === f.friend_id ? 'border-[#7b2bff] bg-[#7b2bff]/10' : 'border-white/[0.06] hover:border-white/20')}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {f.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-white font-bold text-sm">{f.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Étape want : collection de l'ami (ou toutes cartes en mode marché) */}
          {step === 'want' && (
            <div className="px-4 pb-4">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une carte…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none text-white" />
              </div>
              {loadingFriend ? (
                <p className="text-center text-white/30 text-sm py-8">Chargement…</p>
              ) : (
                <div className="space-y-1.5">
                  {wantList.slice(0, 50).map(c => (
                    <button key={c.id} onClick={() => { setWanted(c); setSearch(''); setStep('offer') }}
                      className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left',
                        wanted?.id === c.id ? 'border-[#7b2bff] bg-[#7b2bff]/10' : 'border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]')}>
                      <CardThumb name={c.name} imageUrl={c.image_url} rarity={c.rarity} />
                      {wanted?.id === c.id && <Check size={14} className="text-[#7b2bff] flex-shrink-0" />}
                    </button>
                  ))}
                  {wantList.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucune carte trouvée</p>}
                </div>
              )}
            </div>
          )}

          {/* Étape offer : mes cartes */}
          {step === 'offer' && (
            <div className="px-4 pb-4">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une carte…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none text-white" />
              </div>
              <div className="space-y-1.5">
                {offerList.slice(0, 50).map(c => (
                  <button key={c.cardId} onClick={() => { setOffered(c); setSearch(''); setStep('confirm') }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left',
                      offered?.cardId === c.cardId ? 'border-[#7b2bff] bg-[#7b2bff]/10' : 'border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]')}>
                    <CardThumb name={c.name} imageUrl={c.image_url} rarity={c.rarity} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-white/30">x{c.count}</span>
                      {offered?.cardId === c.cardId && <Check size={14} className="text-[#7b2bff]" />}
                    </div>
                  </button>
                ))}
                {offerList.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucune carte dans ta collection</p>}
              </div>
            </div>
          )}

          {/* Étape confirm */}
          {step === 'confirm' && offered && wanted && (marketMode || receiver) && (
            <div className="px-4 pb-4 space-y-4">
              <div className="rounded-2xl border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs mb-1.5">Tu offres</p>
                    <CardThumb name={offered.name} imageUrl={offered.image_url} rarity={offered.rarity} />
                  </div>
                  <ArrowLeftRight size={18} className="text-white/20 flex-shrink-0" />
                  <div className="text-right">
                    <p className="text-white/40 text-xs mb-1.5">Tu veux</p>
                    <CardThumb name={wanted.name} imageUrl={wanted.image_url} rarity={wanted.rarity} />
                  </div>
                </div>
                {!marketMode && receiver && (
                  <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold text-white">
                      {receiver.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-white/60 text-sm">Proposé à <span className="text-white font-bold">{receiver.username}</span></span>
                  </div>
                )}
                {marketMode && (
                  <div className="border-t border-white/[0.06] pt-3">
                    <span className="text-white/40 text-xs">Visible par tous — quelqu&apos;un peut accepter ce trade</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-white/40 text-xs block mb-1.5">Message (optionnel)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Un petit mot…" rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none text-white resize-none" />
              </div>

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
          {step !== firstStep && (
            <button onClick={() => {
              setSearch('')
              const idx = steps.indexOf(step as 'want' | 'offer' | 'confirm')
              if (idx > 0) setStep(steps[idx - 1] as 'friend' | 'want' | 'offer' | 'confirm')
            }} className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold hover:bg-white/5">
              Retour
            </button>
          )}
          {step === 'confirm' && (
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              {saving ? 'Envoi…' : marketMode ? 'Publier sur le marché' : 'Envoyer la proposition'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
function CommunauteContent() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const { fetchCards } = useCards()
  const router = useRouter()
  const unreadMessageCount = useSocialStore(s => s.unreadMessageCount)
  const unreadBySender = useSocialStore(s => s.unreadBySender)
  const clearUnreadMessages = useSocialStore(s => s.clearUnreadMessages)
  const [ladder, setLadder]           = useState<'xp' | 'combat' | 'trades' | 'marche'>('xp')
  const [showRules, setShowRules]     = useState(false)
  const [entries, setEntries]         = useState<LadderEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [showFriends, setShowFriends] = useState(false)
  const [friends, setFriends]         = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [addedFromLadder, setAddedFromLadder] = useState<Set<string>>(new Set())
  const [sentPending, setSentPending] = useState<Set<string>>(new Set())

  // Trades state
  const [trades, setTrades]         = useState<Trade[]>([])
  const [tradeTab, setTradeTab]     = useState<'incoming' | 'outgoing'>('incoming')
  const [showCreate, setShowCreate] = useState(false)
  const [cardDefs, setCardDefs]     = useState<Record<string, { name: string; image_url: string | null }>>({})
  const [actioning, setActioning]   = useState<string | null>(null)
  const [tradeMsg, setTradeMsg]     = useState('')

  // Marché state
  const [market, setMarket]           = useState<MarketOffer[]>([])
  const [myOffers, setMyOffers]       = useState<MarketOffer[]>([])
  const [marketTab, setMarketTab]     = useState<'browse' | 'mine'>('browse')
  const [showMarketCreate, setShowMarketCreate] = useState(false)
  const [marketActioning, setMarketActioning]   = useState<string | null>(null)
  const [marketMsg, setMarketMsg]     = useState('')

  const loadLadder = useCallback(async () => {
    setLoading(true)
    const type = ladder === 'combat' ? 'combat' : 'collection'
    const data = await fetch(`/api/ladder?type=${type}&limit=50`).then(r => r.ok ? r.json() : [])
    setEntries(data.map((e: Record<string, unknown>) => ({
      user_id:       e.userId ?? e.user_id,
      username:      e.username,
      avatar_url:    e.avatarUrl ?? e.avatar_url,
      xp:            e.xp ?? 0,
      level:         e.level ?? 1,
      highest_rarity: e.highestRarity ?? e.highest_rarity ?? null,
      unique_cards:      (e.unique ?? e.unique_cards ?? 0) as number,
      totalCards:        (e.total ?? 0) as number,
      packsOpened:       (e.packsOpened ?? 0) as number,
      role:               (e.role ?? null) as UserRole,
      void_cards:         e.void_cards ?? 0,
      collectionComplete: e.collectionComplete ?? false,
      is_subscriber:      (e.is_subscriber ?? false) as boolean,
      wins:          (e.wins ?? 0) as number,
      losses:        (e.losses ?? 0) as number,
      rankPoints:    (e.rankPoints ?? 0) as number,
      currentStreak: (e.currentStreak ?? 0) as number,
      bestStreak:    (e.bestStreak ?? 0) as number,
    })))
    setLoading(false)
  }, [ladder])

  const loadFriends = useCallback(async () => {
    if (!user) return
    const data = await fetch('/api/social/friends').then(r => r.ok ? r.json() : [])
    setFriends(data.map((f: Record<string, unknown>) => ({
      id:                 f.friendshipId ?? f.id,
      friend_id:          f.userId ?? f.friend_id,
      username:           f.username ?? null,
      avatar_url:         f.avatarUrl ?? f.avatar_url ?? null,
      status:             f.status ?? 'accepted',
      collectionComplete: f.collectionComplete ?? false,
      activeSessionId: f.activeSessionId ?? null,
    })))
  }, [user])

  const loadPendingRequests = useCallback(async () => {
    if (!user) return
    const data = await fetch('/api/social/friends/pending').then(r => r.ok ? r.json() : [])
    setPendingRequests(data.map((f: Record<string, unknown>) => ({
      id:         f.friendshipId ?? f.id,
      friend_id:  f.senderId ?? f.friend_id,
      username:   f.username ?? null,
      avatar_url: f.avatarUrl ?? f.avatar_url ?? null,
      status:     'pending',
    })))
  }, [user])

  const loadSentPending = useCallback(async () => {
    if (!user) return
    const data = await fetch('/api/social/friends/pending?direction=sent').then(r => r.ok ? r.json() : [])
    setSentPending(new Set(data.map((f: Record<string, unknown>) => (f.userId ?? f.receiverId) as string)))
  }, [user])

  const loadTrades = useCallback(async () => {
    if (!user) return
    const [pending, cards] = await Promise.all([
      fetch('/api/trade?status=pending').then(r => r.ok ? r.json() : []),
      fetchCards(),
    ])
    setTrades(pending ?? [])
    const defs: Record<string, { name: string; image_url: string | null }> = {}
    for (const c of cards ?? []) {
      const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
      defs[c.id] = { name: c.name, image_url: c.imageUrl ?? c.image_url ?? meta?.image_url ?? null }
    }
    setCardDefs(defs)
  }, [user])

  const loadMarket = useCallback(async () => {
    if (!user) return
    const [browse, mine] = await Promise.all([
      fetch('/api/market').then(r => r.ok ? r.json() : []),
      fetch('/api/market?mine=1').then(r => r.ok ? r.json() : []),
    ])
    setMarket(browse)
    setMyOffers(mine.filter((o: MarketOffer) => o.status === 'open'))
  }, [user])

  async function marketAction(offerId: string, act: 'accept' | 'cancel') {
    setMarketActioning(offerId)
    try {
      const res = await fetch(`/api/market/${offerId}/${act}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMarketMsg(data.error ?? 'Erreur'); setTimeout(() => setMarketMsg(''), 4000); return }
      setMarketMsg(act === 'accept' ? 'Échange effectué !' : 'Offre annulée.')
      setTimeout(() => setMarketMsg(''), 3000)
      loadMarket()
    } finally { setMarketActioning(null) }
  }

  useEffect(() => { loadLadder() }, [loadLadder, ladder])
  useEffect(() => { if (user) { loadFriends(); loadPendingRequests(); loadSentPending() } }, [loadFriends, loadPendingRequests, loadSentPending, user])
  useEffect(() => { if (user && ladder === 'trades') loadTrades() }, [user, ladder, loadTrades])
  useEffect(() => { if (user && ladder === 'marche') loadMarket() }, [user, ladder, loadMarket])

  const myRank = user ? entries.findIndex(e => e.user_id === user.id) + 1 : 0

  async function addFriendFromLadder(targetId: string) {
    const res = await fetch('/api/social/friends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: targetId }),
    })
    if (res.ok || res.status === 409) {
      setAddedFromLadder(s => new Set([...s, targetId]))
      setSentPending(s => new Set([...s, targetId]))
    }
  }

  async function tradeAction(tradeId: string, act: 'accept' | 'decline' | 'cancel') {
    setActioning(tradeId)
    try {
      const res = await fetch(`/api/trade/${tradeId}/${act}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setTradeMsg(data.error ?? 'Erreur'); setTimeout(() => setTradeMsg(''), 4000); return }
      setTradeMsg(act === 'accept' ? '✅ Trade accepté !' : act === 'decline' ? 'Trade refusé.' : 'Trade annulé.')
      setTimeout(() => setTradeMsg(''), 3000)
      loadTrades()
    } finally { setActioning(null) }
  }

  const incoming = trades.filter(t => t.receiverId === user?.id)
  const outgoing  = trades.filter(t => t.senderId   === user?.id)
  const displayed = tradeTab === 'incoming' ? incoming : outgoing

  if (!user) return (
    <StatePanel icon={LinkIcon} title="Pas connecté">
      Connecte-toi pour voir le classement, tes amis et tes échanges.
    </StatePanel>
  )

  return (
    <div className="pb-4 relative max-w-4xl mx-auto w-full">
      <div className="lg:flex lg:gap-6 lg:items-start">
      <div className="lg:flex-1 lg:min-w-0">

      {/* Header */}
      <div
        className="sticky top-20 z-20 mb-4 px-4 py-3 rounded-2xl border border-white/[0.07] backdrop-blur-md"
        style={{ backgroundColor: 'rgba(8,10,18,0.88)' }}
      >
        {/* Titre + actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white text-base tracking-tight">Communauté</h2>
            {myRank > 0 && ladder !== 'trades' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.06] text-white/40 border border-white/[0.08]">
                #{myRank}
              </span>
            )}
          </div>
          {user && (
            <button onClick={() => setShowFriends(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] text-xs font-bold hover:bg-[#7b2bff]/25 transition-colors">
              <Users size={12} /> Amis {friends.length > 0 && `(${friends.length})`}
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 p-1 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06]">
            {(['xp', 'combat', 'trades', 'marche'] as const).map(tab => (
              <button key={tab} onClick={() => setLadder(tab)}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative',
                  ladder === tab ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
                {tab === 'xp' ? 'XP' : tab === 'combat' ? 'Combat' : tab === 'trades' ? 'Trades' : 'Marché'}
                {tab === 'trades' && incoming.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[9px] font-bold flex items-center justify-center">
                    {incoming.length > 9 ? '9+' : incoming.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {ladder !== 'trades' && (
            <div className="relative group flex-shrink-0">
              <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/40 text-[11px] font-bold cursor-default hover:border-white/40 hover:text-white/60 transition-colors">
                i
              </div>
              <div className="absolute right-0 top-8 w-56 p-3 rounded-xl bg-[#0f0c1f] border border-white/10 text-white/60 text-xs leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
                {ladder === 'xp'
                  ? 'Le ladder XP classe les joueurs selon leur expérience totale accumulée en ouvrant des boosters.'
                  : 'Le ladder Combat classe les joueurs selon leurs victoires en combat multijoueur.'}
              </div>
            </div>
          )}
          {ladder === 'trades' && user && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              <Plus size={12} /> Proposer
            </button>
          )}
        </div>
      </div>

      {/* Bouton entrer dans l'arène + règles */}
      {ladder === 'combat' && user && (
        <div className="flex gap-2 mb-4">
          <Link href="/combat/draft"
            className="flex items-center justify-center gap-2 flex-1 py-3 rounded-2xl bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] font-bold text-sm hover:bg-[#7b2bff]/25 transition-colors">
            <Swords size={16} /> Entrer dans l&apos;Arène
          </Link>
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/50 font-bold text-sm hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <BookOpen size={15} /> Règles
          </button>
        </div>
      )}
      {showRules && <CombatRulesModal onClose={() => setShowRules(false)} />}

      {/* Ladder XP / Combat */}
      {(ladder === 'xp' || ladder === 'combat') && (
        loading ? (
          <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = user?.id === entry.user_id
              const rank = i + 1
              return (
                <div key={entry.user_id}
                  className={cn('flex items-center gap-3 p-3 rounded-2xl border transition-all backdrop-blur-sm',
                    isMe ? 'bg-[#7b2bff]/10 border-[#7b2bff]/30' : 'bg-white/[0.03] border-white/[0.06]')}>
                  <div className="w-8 text-center flex-shrink-0">
                    {rank <= 3 ? (
                      <span title={rank === 1 ? '1ère place' : rank === 2 ? '2ème place' : '3ème place'} className="inline-flex">
                        <Medal size={18} style={{ color: rank === 1 ? RARITY_COLOR.void : rank === 2 ? RARITY_COLOR.legendary : RARITY_COLOR.epic, filter: `drop-shadow(0 0 5px ${rank === 1 ? RARITY_COLOR.void : rank === 2 ? RARITY_COLOR.legendary : RARITY_COLOR.epic}99)` }} />
                      </span>
                    ) : (
                      <span className="text-white/30 text-xs font-bold">#{rank}</span>
                    )}
                  </div>

                  <AvatarRing
                    avatarUrl={entry.avatar_url}
                    username={entry.username}
                    size={36}
                    isComplete={entry.collectionComplete}
                  />

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/profil/${entry.user_id}`)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('font-bold text-sm truncate', isMe ? 'text-[#a78bfa]' : 'text-white')}>
                        {entry.username ?? 'Joueur'}
                        {isMe && <span className="text-xs text-white/40 font-normal ml-1">(toi)</span>}
                      </p>
                      <RoleBadge role={entry.role} />
                      <SubscriberBadge isSubscriber={entry.is_subscriber} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ladder === 'combat' ? (
                        <>
                          <span className="text-white/40 text-[11px]">Niv. {entry.level}</span>
                          <span className="text-white/35 text-[11px]">{entry.wins ?? 0}V · {entry.losses ?? 0}D</span>
                        </>
                      ) : (
                        <>
                          <span className="text-white/40 text-[11px]">Niv. {entry.level}</span>
                          <span className="flex items-center gap-1 text-white/30 text-[11px]"><BookOpen size={10} /> {entry.unique_cards} uniques · {entry.totalCards ?? 0} en tout</span>
                          <span className="flex items-center gap-1 text-white/25 text-[11px]"><Package size={10} /> {entry.packsOpened ?? 0} boosters ouverts</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {ladder === 'combat' ? (
                      <>
                        <p className="text-white font-bold text-sm">{(entry.rankPoints ?? 0).toLocaleString('fr-FR')} <span className="text-white/30 text-[10px] font-normal">pts</span></p>
                        {(entry.currentStreak ?? 0) > 1
                          ? <p className="text-[#ff9a3d] text-[10px] font-bold">🔥 Streak : {entry.currentStreak} victoires</p>
                          : <p className="text-white/20 text-[10px]">Meilleur streak : {entry.bestStreak ?? 0}</p>
                        }
                      </>
                    ) : (
                      <>
                        <p className="text-white font-bold text-sm">{entry.xp.toLocaleString('fr-FR')}</p>
                        <p className="text-white/30 text-[10px]">XP</p>
                      </>
                    )}
                  </div>

                  {user && !isMe && (
                    friends.some(f => f.friend_id === entry.user_id) ? (
                      <button className="ml-1 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" title="Déjà ami" disabled>
                        <Check size={13} className="text-[#4a9e6a]" />
                      </button>
                    ) : (sentPending.has(entry.user_id) || addedFromLadder.has(entry.user_id)) ? (
                      <button className="ml-1 flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center" title="Demande en attente" disabled>
                        <Clock size={13} className="text-white/40" />
                      </button>
                    ) : (
                      <button onClick={() => addFriendFromLadder(entry.user_id)}
                        className="ml-1 flex-shrink-0 w-7 h-7 rounded-full bg-[#7b2bff]/15 border border-[#7b2bff]/30 flex items-center justify-center hover:bg-[#7b2bff]/30 transition-colors"
                        title="Ajouter en ami">
                        <UserPlus size={13} className="text-[#a78bfa]" />
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Trades */}
      {ladder === 'trades' && (
        <div>
          {!user && (
            <div className="flex items-center justify-center h-40 text-white/40 text-sm">Connecte-toi pour accéder aux trades.</div>
          )}
          {user && (
            <>
              {tradeMsg && (
                <div className="mb-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm text-white text-center">{tradeMsg}</div>
              )}

              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] mb-4">
                {(['incoming', 'outgoing'] as const).map(t => (
                  <button key={t} onClick={() => setTradeTab(t)}
                    className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative',
                      tradeTab === t ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
                    {t === 'incoming' ? 'Reçus' : 'Envoyés'}
                    {t === 'incoming' && incoming.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[9px] font-bold flex items-center justify-center">
                        {incoming.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {displayed.length === 0 ? (
                <div className="text-center text-white/30 text-sm py-12">
                  {tradeTab === 'incoming' ? 'Aucun trade reçu en attente.' : 'Aucun trade envoyé en attente.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayed.map(trade => {
                    const offeredDef = cardDefs[trade.offeredCardKey]
                    const wantedDef  = cardDefs[trade.wantedCardKey]
                    const isSender    = trade.senderId === user.id
                    const otherName   = isSender ? trade.receiverUsername : trade.senderUsername
                    const otherAvatar = isSender ? trade.receiverAvatarUrl : trade.senderAvatarUrl
                    return (
                      <div key={trade.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4">
                        {/* Counterpart */}
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
                          {otherAvatar
                            ? <img src={otherAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{otherName[0]?.toUpperCase()}</div>
                          }
                          <span className="text-white/50 text-xs">
                            {isSender ? 'Proposé à' : 'Reçu de'}{' '}
                            <span className="text-white font-bold">{otherName}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <p className="text-white/30 text-[10px] mb-1.5">{isSender ? 'Tu offres' : `${otherName} offre`}</p>
                            <CardThumb name={offeredDef?.name ?? trade.offeredCardKey} imageUrl={offeredDef?.image_url} rarity={trade.offeredRarity} />
                          </div>
                          <ArrowLeftRight size={16} className="text-white/20 flex-shrink-0" />
                          <div className="flex-1 text-right">
                            <p className="text-white/30 text-[10px] mb-1.5">{isSender ? 'Tu veux' : `${otherName} veut`}</p>
                            <div className="flex flex-col items-end">
                              <CardThumb name={wantedDef?.name ?? trade.wantedCardName ?? trade.wantedCardKey} imageUrl={wantedDef?.image_url} rarity={trade.wantedRarity ?? 'common'} />
                            </div>
                          </div>
                        </div>

                        {trade.message && (
                          <p className="text-white/40 text-xs italic border-t border-white/[0.06] pt-2 mb-2">&ldquo;{trade.message}&rdquo;</p>
                        )}

                        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                          <div className="flex items-center gap-1 text-white/30 text-[10px]">
                            <Clock size={11} />
                            {trade.expiresAt ? `Expire le ${formatDate(trade.expiresAt)}` : formatDate(trade.createdAt)}
                          </div>
                          <div className="flex gap-2">
                            {!isSender && (
                              <>
                                <button onClick={() => tradeAction(trade.id, 'decline')} disabled={!!actioning}
                                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                                  Refuser
                                </button>
                                <button onClick={() => tradeAction(trade.id, 'accept')} disabled={!!actioning}
                                  className="px-3 py-1.5 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                                  style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                                  {actioning === trade.id ? '…' : 'Accepter'}
                                </button>
                              </>
                            )}
                            {isSender && (
                              <button onClick={() => tradeAction(trade.id, 'cancel')} disabled={!!actioning}
                                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                                {actioning === trade.id ? '…' : 'Annuler'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Marché */}
      {ladder === 'marche' && (
        <div>
          {user && (
            <button onClick={() => setShowMarketCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              <Plus size={14} /> Proposer un échange
            </button>
          )}
          {marketMsg && (
            <div className="mb-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm text-white text-center">{marketMsg}</div>
          )}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] mb-4">
            {(['browse', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setMarketTab(t)}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                  marketTab === t ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
                {t === 'browse' ? 'Offres disponibles' : 'Mes offres'}
              </button>
            ))}
          </div>
          {!user ? (
            <p className="text-white/30 text-sm text-center py-10">Connecte-toi pour voir le marché.</p>
          ) : marketTab === 'browse' ? (
            market.length === 0
              ? <p className="text-white/30 text-sm text-center py-10">Aucune offre disponible pour l'instant.</p>
              : <div className="space-y-3">
                {market.map(offer => {
                  const offeredDef = cardDefs[offer.offeredCardKey]
                  const wantedDef  = cardDefs[offer.wantedCardKey]
                  return (
                    <div key={offer.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
                        {offer.sellerAvatarUrl
                          ? <img src={offer.sellerAvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{offer.sellerUsername[0]?.toUpperCase()}</div>
                        }
                        <span className="text-white/50 text-xs">Offert par <span className="text-white font-bold">{offer.sellerUsername}</span></span>
                      </div>
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <p className="text-white/30 text-[10px] mb-1.5">{offer.sellerUsername} offre</p>
                          <CardThumb name={offeredDef?.name ?? offer.offeredCardKey} imageUrl={offeredDef?.image_url} rarity={offer.offeredRarity} />
                        </div>
                        <ArrowLeftRight size={16} className="text-white/20 flex-shrink-0" />
                        <div className="flex-1 text-right">
                          <p className="text-white/30 text-[10px] mb-1.5">{offer.sellerUsername} veut</p>
                          <div className="flex flex-col items-end">
                            <CardThumb name={wantedDef?.name ?? offer.wantedCardName ?? offer.wantedCardKey} imageUrl={wantedDef?.image_url} rarity={offer.wantedRarity ?? 'common'} />
                          </div>
                        </div>
                      </div>
                      {offer.message && (
                        <p className="text-white/40 text-xs italic border-t border-white/[0.06] pt-2 mb-2">&ldquo;{offer.message}&rdquo;</p>
                      )}
                      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                        <div className="flex items-center gap-1 text-white/30 text-[10px]">
                          <Clock size={11} />
                          {offer.expiresAt ? `Expire le ${formatDate(offer.expiresAt)}` : formatDate(offer.createdAt)}
                        </div>
                        {user && (
                          <button onClick={() => marketAction(offer.id, 'accept')} disabled={!!marketActioning}
                            className="px-3 py-1.5 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                            {marketActioning === offer.id ? '…' : 'Accepter'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
          ) : (
            myOffers.length === 0
              ? <p className="text-white/30 text-sm text-center py-10">Aucune offre active.</p>
              : <div className="space-y-3">
                {myOffers.map(offer => {
                  const offeredDef = cardDefs[offer.offeredCardKey]
                  const wantedDef  = cardDefs[offer.wantedCardKey]
                  return (
                    <div key={offer.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <p className="text-white/30 text-[10px] mb-1.5">Tu offres</p>
                          <CardThumb name={offeredDef?.name ?? offer.offeredCardKey} imageUrl={offeredDef?.image_url} rarity={offer.offeredRarity} />
                        </div>
                        <ArrowLeftRight size={16} className="text-white/20 flex-shrink-0" />
                        <div className="flex-1 text-right">
                          <p className="text-white/30 text-[10px] mb-1.5">Tu veux</p>
                          <div className="flex flex-col items-end">
                            <CardThumb name={wantedDef?.name ?? offer.wantedCardName ?? offer.wantedCardKey} imageUrl={wantedDef?.image_url} rarity={offer.wantedRarity ?? 'common'} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                        <div className="flex items-center gap-1 text-white/30 text-[10px]">
                          <Clock size={11} />
                          {offer.expiresAt ? `Expire le ${formatDate(offer.expiresAt)}` : formatDate(offer.createdAt)}
                        </div>
                        <button onClick={() => marketAction(offer.id, 'cancel')} disabled={!!marketActioning}
                          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                          {marketActioning === offer.id ? '…' : 'Annuler'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
          )}
        </div>
      )}

      </div>
      </div>

      {/* Modal marché */}
      {showMarketCreate && (
        <CreateTradeModal
          onClose={() => setShowMarketCreate(false)}
          onCreated={() => { setShowMarketCreate(false); loadMarket() }}
          marketMode
        />
      )}

      {/* Modal amis */}
      {showFriends && (
        <FriendsModal
          user={user}
          friends={friends}
          pendingRequests={pendingRequests}
          unreadBySender={unreadBySender}
          onClose={() => setShowFriends(false)}
          onChallenge={(f) => {
            sessionStorage.setItem('challenge_friend', JSON.stringify({ id: f.friend_id, username: f.username }))
            setShowFriends(false)
            router.push('/combat/draft?mode=friendly')
          }}
          onSpectate={(f) => {
            setShowFriends(false)
            router.push(`/combat/spectate/${f.activeSessionId}?p=${f.friend_id}`)
          }}
          onRefresh={() => { loadFriends(); loadPendingRequests() }}
        />
      )}

      {/* Modal création trade */}
      {showCreate && (
        <CreateTradeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadTrades() }} />
      )}

    </div>
  )
}

// ─── Modal Amis ───────────────────────────────────────────────────────────────
function FriendsModal({ user, friends, pendingRequests, unreadBySender, onClose, onChallenge, onSpectate, onRefresh }: {
  user: { id: string } | null
  friends: Friend[]
  pendingRequests: Friend[]
  unreadBySender: Record<string, number>
  onClose: () => void
  onChallenge: (f: Friend) => void
  onSpectate: (f: Friend) => void
  onRefresh: () => void
}) {
  const [search, setSearch]   = useState('')
  const [results, setResults] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState<Set<string>>(new Set())

  async function searchUsers(q: string) {
    if (!q.trim() || !user) return
    setLoading(true)
    const data = await fetch(`/api/social/search?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : [])
    setResults(data ?? [])
    setLoading(false)
  }

  async function sendRequest(targetId: string) {
    if (!user) return
    await fetch('/api/social/friends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: targetId }),
    })
    setSent(s => new Set([...s, targetId]))
  }

  async function removeFriend(friendshipId: number) {
    await fetch('/api/social/friends', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    })
    onRefresh()
  }

  async function acceptRequest(friendshipId: number) {
    await fetch('/api/social/friends', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, accept: true }),
    })
    onRefresh()
  }

  async function declineRequest(friendshipId: number) {
    await fetch('/api/social/friends', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, accept: false }),
    })
    onRefresh()
  }

  void loading

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#0a0816] border border-[#7b2bff]/20 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-base"><Users size={13} className='inline mr-1' />Amis</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {pendingRequests.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Demandes reçues</p>
            {pendingRequests.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#7b2bff]/10 border border-[#7b2bff]/20">
                <AvatarRing avatarUrl={r.avatar_url} username={r.username} size={32} />
                <span className="flex-1 text-sm text-white">{r.username ?? 'Joueur'}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => acceptRequest(r.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4a9e6a]/20 hover:bg-[#4a9e6a]/35 text-[#4a9e6a] text-xs font-bold">
                    <Check size={11} /> Accepter
                  </button>
                  <button onClick={() => declineRequest(r.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs font-bold">
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers(search)}
            placeholder="Rechercher un joueur…"
            className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none"
          />
          <button onClick={() => searchUsers(search)}
            className="px-3 py-2 rounded-xl bg-[#7b2bff]/20 border border-[#7b2bff]/30 text-[#a78bfa] text-sm font-bold">
            <Search size={14} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2 mb-4">
            {results.map(r => (
              <div key={r.user_id} className="flex items-center gap-3 p-2 rounded-xl bg-white/3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.username?.[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm text-white">{r.username}</span>
                {friends.some(f => f.friend_id === r.user_id) ? (
                  <span className="flex items-center gap-1 text-xs text-[#4a9e6a]"><Check size={11} /> Ami</span>
                ) : sent.has(r.user_id) ? (
                  <span className="text-xs text-white/40">Demande envoyée</span>
                ) : (
                  <button onClick={() => sendRequest(r.user_id)}
                    className="px-2 py-1 rounded-lg bg-[#7b2bff]/20 text-[#a78bfa] text-xs font-bold hover:bg-[#7b2bff]/40">
                    + Ajouter
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {friends.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Aucun ami pour l&apos;instant.</p>
          ) : friends.map(f => {
            const unread = unreadBySender[f.friend_id] ?? 0
            return (
            <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/3">
              <div className="relative flex-shrink-0">
                <AvatarRing avatarUrl={f.avatar_url} username={f.username} size={32} isComplete={f.collectionComplete} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[9px] font-bold flex items-center justify-center z-10">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span className={cn('flex-1 text-sm', unread > 0 ? 'text-white font-bold' : 'text-white')}>{f.username ?? 'Joueur'}</span>
              <div className="flex gap-1.5">
                {f.activeSessionId && (
                  <button onClick={() => onSpectate(f)}
                    className="px-2 py-1 rounded-lg bg-[#4a9e6a]/15 hover:bg-[#4a9e6a]/30 text-[#4a9e6a] text-xs animate-pulse"
                    title="Regarder la partie en cours">
                    <Eye size={13} />
                  </button>
                )}
                <button onClick={() => onChallenge(f)}
                  className="px-2 py-1 rounded-lg bg-[#7b2bff]/15 hover:bg-[#7b2bff]/30 text-[#a78bfa] text-xs"
                  title="Défier en partie amicale">
                  <Sword size={13} />
                </button>

                <button onClick={() => removeFriend(f.id)}
                  className="px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs">
                  <X size={13} />
                </button>
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}

export default function CommunautePage() {
  return (
    <FeatureGate featureKey="feature_social" label="La section sociale">
      <CommunauteContent />
    </FeatureGate>
  )
}

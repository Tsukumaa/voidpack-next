'use client'
import { Users, MessageCircle, Search, X, Medal, BookOpen, Hexagon, Check, Swords, Sword, UserPlus } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { cn } from '@/lib/utils'

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
}

interface Friend {
  id: number
  friend_id: string
  username: string | null
  avatar_url: string | null
  status: string
}


const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899',
  rare: '#4aa3ff', common: '#9ca3af',
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CommunautePage() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const setChatFriend = useSocialStore(s => s.setChatFriend)
  const [ladder, setLadder]           = useState<'xp' | 'combat'>('xp')
  const [entries, setEntries]         = useState<LadderEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [showFriends, setShowFriends] = useState(false)
  const [friends, setFriends]         = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [addedFromLadder, setAddedFromLadder] = useState<Set<string>>(new Set())

  const loadLadder = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/ladder?type=collection&limit=50').then(r => r.ok ? r.json() : [])
    setEntries(data.map((e: Record<string, unknown>) => ({
      user_id:       e.userId ?? e.user_id,
      username:      e.username,
      avatar_url:    e.avatarUrl ?? e.avatar_url,
      xp:            e.xp ?? 0,
      level:         e.level ?? 1,
      highest_rarity: e.highestRarity ?? e.highest_rarity ?? null,
      unique_cards:  e.total ?? e.unique_cards ?? 0,
      void_cards:    e.void_cards ?? 0,
    })))
    setLoading(false)
  }, [])

  const loadFriends = useCallback(async () => {
    if (!user) return
    const data = await fetch('/api/social/friends').then(r => r.ok ? r.json() : [])
    setFriends(data.map((f: Record<string, unknown>) => ({
      id:         f.friendshipId ?? f.id,
      friend_id:  f.userId ?? f.friend_id,
      username:   f.username ?? null,
      avatar_url: f.avatarUrl ?? f.avatar_url ?? null,
      status:     f.status ?? 'accepted',
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

  useEffect(() => { loadLadder() }, [loadLadder])
  useEffect(() => { if (user) { loadFriends(); loadPendingRequests() } }, [loadFriends, loadPendingRequests, user])

  const myRank = user ? entries.findIndex(e => e.user_id === user.id) + 1 : 0

  async function addFriendFromLadder(targetId: string) {
    const res = await fetch('/api/social/friends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: targetId }),
    })
    if (res.ok || res.status === 409) {
      setAddedFromLadder(s => new Set([...s, targetId]))
    }
  }

  return (
    <div className="pb-4 relative">
      {/* Desktop : deux colonnes */}
      <div className="lg:flex lg:gap-6 lg:items-start">
      {/* Colonne principale (ladder) */}
      <div className="lg:flex-1 lg:min-w-0">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#030308]/90 backdrop-blur-md pt-3 pb-2 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-base">Communauté</h2>
          <div className="flex items-center gap-2">
            {myRank > 0 && (
              <span className="text-white/40 text-xs">Tu es #{myRank}</span>
            )}
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
        </div>

        {/* Tabs ladder */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {(['xp', 'combat'] as const).map(tab => (
              <button key={tab} onClick={() => setLadder(tab)}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                  ladder === tab ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
                {tab === 'xp' ? 'Ladder XP' : 'Ladder Combat'}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      {/* Bouton entrer dans l'arène (onglet Combat seulement) */}
      {ladder === 'combat' && user && (
        <a href="/combat/draft"
          className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-2xl bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] font-bold text-sm hover:bg-[#7b2bff]/25 transition-colors">
          <Swords size={16} /> Entrer dans l'Arène
        </a>
      )}

      {/* Ladder */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const isMe = user?.id === entry.user_id
            const rank = i + 1
            const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : null
            const rankTitle = rank === 1 ? { label: 'VOID', color: '#a855f7' } : rank === 2 ? { label: 'Légendaire', color: '#ff9a3d' } : rank === 3 ? { label: 'Épique', color: '#ec4899' } : null
            return (
              <div key={entry.user_id}
                className={cn('flex items-center gap-3 p-3 rounded-2xl border transition-all',
                  isMe
                    ? 'bg-[#7b2bff]/10 border-[#7b2bff]/30'
                    : 'bg-white/[0.03] border-white/[0.06]'
                )}>
                {/* Rang */}
                <div className="w-8 text-center flex-shrink-0">
                  {rank <= 3 ? (
                    <Medal size={18} style={{ color: rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32' }} />
                  ) : (
                    <span className="text-white/30 text-xs font-bold">#{rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-white/10"
                  style={entry.avatar_url ? { backgroundImage: `url(${entry.avatar_url})`, backgroundSize: 'cover' }
                    : { background: 'linear-gradient(135deg, #7b2bff, #4a1fa8)' }}>
                  {!entry.avatar_url && (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                      {entry.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('font-bold text-sm truncate', isMe ? 'text-[#a78bfa]' : 'text-white')}>
                      {entry.username ?? 'Joueur'}
                      {isMe && <span className="text-xs text-white/40 font-normal ml-1">(toi)</span>}
                    </p>
                    {rankTitle && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 tracking-wide"
                        style={{ color: rankTitle.color, background: rankTitle.color + '22', border: `1px solid ${rankTitle.color}55` }}>
                        {rankTitle.label}
                      </span>
                    )}
                    {!rankTitle && entry.highest_rarity && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: RARITY_COLOR[entry.highest_rarity], background: RARITY_COLOR[entry.highest_rarity] + '20' }}>
                        {entry.highest_rarity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-[11px]">Niv. {entry.level}</span>
                    <span className="flex items-center gap-1 text-white/30 text-[11px]"><BookOpen size={10} /> {entry.unique_cards} cartes</span>
                    {entry.void_cards > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: RARITY_COLOR.void }}>
                        <Hexagon size={10} /> {entry.void_cards} void
                      </span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold text-sm">{entry.xp.toLocaleString('fr-FR')}</p>
                  <p className="text-white/30 text-[10px]">XP</p>
                </div>

                {/* Add friend */}
                {user && !isMe && (
                  friends.some(f => f.friend_id === entry.user_id) ? (
                    <button
                      className="ml-1 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                      title="Déjà ami"
                      disabled>
                      <Check size={13} className="text-[#00c896]" />
                    </button>
                  ) : addedFromLadder.has(entry.user_id) ? (
                    <button className="ml-1 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" disabled>
                      <Check size={13} className="text-white/30" />
                    </button>
                  ) : (
                    <button
                      onClick={() => addFriendFromLadder(entry.user_id)}
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
      )}

      </div> {/* fin colonne principale */}

      </div> {/* fin lg:flex */}

      {/* Modal amis */}
      {showFriends && (
        <FriendsModal
          user={user}
          friends={friends}
          pendingRequests={pendingRequests}
          onClose={() => setShowFriends(false)}
          onChat={(f) => { setChatFriend({ friend_id: f.friend_id, username: f.username, avatar_url: f.avatar_url }); setShowFriends(false) }}
          onChallenge={(f) => {
            sessionStorage.setItem('challenge_friend', JSON.stringify({ id: f.friend_id, username: f.username }))
            setShowFriends(false)
            window.location.href = '/combat/draft?mode=friendly'
          }}
          onRefresh={() => { loadFriends(); loadPendingRequests() }}
        />
      )}

      {/* Bouton chat flottant si amis */}
      {friends.length > 0 && user && (
        <div className="fixed bottom-24 right-16 z-40">
          <button onClick={() => setShowFriends(true)}
            className="w-12 h-12 rounded-full bg-[#7b2bff] shadow-lg shadow-[#7b2bff]/40 flex items-center justify-center hover:scale-105 transition-transform">
            <MessageCircle size={20} className="text-white" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modal Amis ───────────────────────────────────────────────────────────────
function FriendsModal({ user, friends, pendingRequests, onClose, onChat, onChallenge, onRefresh }: {
  user: { id: string } | null
  friends: Friend[]
  pendingRequests: Friend[]
  onClose: () => void
  onChat: (f: Friend) => void
  onChallenge: (f: Friend) => void
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#0a0816] border border-[#7b2bff]/20 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-base"><Users size={13} className='inline mr-1' />Amis</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {/* Demandes reçues */}
        {pendingRequests.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Demandes reçues</p>
            {pendingRequests.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#7b2bff]/10 border border-[#7b2bff]/20">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={r.avatar_url ? { backgroundImage: `url(${r.avatar_url})`, backgroundSize: 'cover' } : {}}>
                  {!r.avatar_url && r.username?.[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm text-white">{r.username ?? 'Joueur'}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => acceptRequest(r.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00c896]/20 hover:bg-[#00c896]/35 text-[#00c896] text-xs font-bold">
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

        {/* Recherche */}
        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers(search)}
            placeholder="Rechercher un joueur…"
            className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#7b2bff]/60 focus:outline-none"
          />
          <button onClick={() => searchUsers(search)}
            className="px-3 py-2 rounded-xl bg-[#7b2bff]/20 border border-[#7b2bff]/30 text-[#a78bfa] text-sm font-bold">
            <Search size={14} />
          </button>
        </div>

        {/* Résultats recherche */}
        {results.length > 0 && (
          <div className="space-y-2 mb-4">
            {results.map(r => (
              <div key={r.user_id} className="flex items-center gap-3 p-2 rounded-xl bg-white/3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {r.username?.[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm text-white">{r.username}</span>
                {friends.some(f => f.friend_id === r.user_id) ? (
                  <span className="flex items-center gap-1 text-xs text-[#00c896]"><Check size={11} /> Ami</span>
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

        {/* Liste amis */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {friends.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Aucun ami pour l'instant.</p>
          ) : friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={f.avatar_url ? { backgroundImage: `url(${f.avatar_url})`, backgroundSize: 'cover' } : {}}>
                {!f.avatar_url && f.username?.[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-white">{f.username ?? 'Joueur'}</span>
              <div className="flex gap-1.5">
                <button onClick={() => onChallenge(f)}
                  className="px-2 py-1 rounded-lg bg-[#7b2bff]/15 hover:bg-[#7b2bff]/30 text-[#a78bfa] text-xs"
                  title="Défier en partie amicale">
                  <Sword size={13} />
                </button>
                <button onClick={() => onChat(f)}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs">
                  <MessageCircle size={13} />
                </button>
                <button onClick={() => removeFriend(f.id)}
                  className="px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs">
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


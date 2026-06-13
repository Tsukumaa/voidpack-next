'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/game'
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

interface Message {
  id: number
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  read_at: string | null
}

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#b86dff',
  rare: '#4aa3ff', uncommon: '#22c55e', common: '#9ca3af',
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CommunautePage() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const [ladder, setLadder]         = useState<'xp' | 'combat'>('xp')
  const [entries, setEntries]       = useState<LadderEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [showFriends, setShowFriends] = useState(false)
  const [chatFriend, setChatFriend] = useState<Friend | null>(null)
  const [friends, setFriends]       = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])

  const loadLadder = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    const { data: profiles } = await sb
      .from('player_profiles')
      .select('user_id, username, avatar_url, xp, level, highest_rarity')
      .order('xp', { ascending: false })
      .limit(50)

    // Charger les stats cartes pour chaque joueur
    const { data: cardStats } = await sb
      .from('player_cards')
      .select('user_id, rarity, card_id')

    const statsMap: Record<string, { unique: Set<string>; void: number }> = {}
    for (const c of cardStats ?? []) {
      if (!statsMap[c.user_id]) statsMap[c.user_id] = { unique: new Set(), void: 0 }
      statsMap[c.user_id].unique.add(c.card_id)
      if (c.rarity === 'void') statsMap[c.user_id].void++
    }

    setEntries((profiles ?? []).map(p => ({
      ...p,
      unique_cards: statsMap[p.user_id]?.unique.size ?? 0,
      void_cards:   statsMap[p.user_id]?.void ?? 0,
    })))
    setLoading(false)
  }, [])

  const loadFriends = useCallback(async () => {
    if (!user) return
    const sb = createClient()
    const { data } = await sb
      .from('friendships')
      .select('id, sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted')

    if (!data) return

    const friendIds = data.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id)
    if (!friendIds.length) { setFriends([]); return }

    const { data: profiles } = await sb
      .from('player_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', friendIds)

    setFriends(data.map(f => {
      const fid = f.sender_id === user.id ? f.receiver_id : f.sender_id
      const profile = profiles?.find(p => p.user_id === fid)
      return { id: f.id, friend_id: fid, username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null, status: f.status }
    }))
  }, [user])

  const loadPendingRequests = useCallback(async () => {
    if (!user) return
    const sb = createClient()
    const { data } = await sb
      .from('friendships')
      .select('id, sender_id, receiver_id, status')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')

    if (!data || !data.length) { setPendingRequests([]); return }

    const senderIds = data.map(f => f.sender_id)
    const { data: profiles } = await sb
      .from('player_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', senderIds)

    setPendingRequests(data.map(f => {
      const profile = profiles?.find(p => p.user_id === f.sender_id)
      return { id: f.id, friend_id: f.sender_id, username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null, status: f.status }
    }))
  }, [user])

  useEffect(() => { loadLadder() }, [loadLadder])
  useEffect(() => { if (user) { loadFriends(); loadPendingRequests() } }, [loadFriends, loadPendingRequests, user])

  const myRank = user ? entries.findIndex(e => e.user_id === user.id) + 1 : 0

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
                className="relative px-3 py-1.5 rounded-xl bg-[#7b2bff]/15 border border-[#7b2bff]/30 text-[#a78bfa] text-xs font-bold hover:bg-[#7b2bff]/25 transition-colors">
                👥 Amis {friends.length > 0 && `(${friends.length})`}
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
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {(['xp', 'combat'] as const).map(tab => (
            <button key={tab} onClick={() => setLadder(tab)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                ladder === tab ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
              {tab === 'xp' ? '⭐ Ladder XP' : '⚔️ Ladder Combat'}
            </button>
          ))}
        </div>
      </div>

      {/* Ladder */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Chargement…</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const isMe = user?.id === entry.user_id
            const rank = i + 1
            const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : null
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
                    <span className="text-lg">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
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
                  <div className="flex items-center gap-2">
                    <p className={cn('font-bold text-sm truncate', isMe ? 'text-[#a78bfa]' : 'text-white')}>
                      {entry.username ?? 'Joueur'}
                      {isMe && <span className="text-xs text-white/40 font-normal ml-1">(toi)</span>}
                    </p>
                    {entry.highest_rarity && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: RARITY_COLOR[entry.highest_rarity], background: RARITY_COLOR[entry.highest_rarity] + '20' }}>
                        {entry.highest_rarity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-[11px]">Niv. {entry.level}</span>
                    <span className="text-white/30 text-[11px]">📚 {entry.unique_cards} cartes</span>
                    {entry.void_cards > 0 && (
                      <span className="text-[11px] font-bold" style={{ color: RARITY_COLOR.void }}>
                        ⬡ {entry.void_cards} void
                      </span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold text-sm">{entry.xp.toLocaleString('fr-FR')}</p>
                  <p className="text-white/30 text-[10px]">XP</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div> {/* fin colonne principale */}

      {/* Colonne droite desktop — carte joueur + placeholder */}
      <div className="hidden lg:block lg:w-[320px] lg:flex-shrink-0 lg:sticky lg:top-20">
        {myRank > 0 && ladder === 'xp' && ladderData[myRank - 1] && (() => {
          const me = ladderData[myRank - 1]
          return (
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 mb-4">
              <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Ta position</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex-shrink-0 flex items-center justify-center text-sm font-bold border border-white/10"
                  style={me.avatar_url ? { backgroundImage:`url(${me.avatar_url})`, backgroundSize:'cover' } : {}}>
                  {!me.avatar_url && me.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{me.username}</p>
                  <p className="text-white/40 text-xs">#{myRank} · {me.xp?.toLocaleString('fr-FR')} XP</p>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
      </div> {/* fin lg:flex */}

      {/* Modal amis */}
      {showFriends && (
        <FriendsModal
          user={user}
          friends={friends}
          pendingRequests={pendingRequests}
          onClose={() => setShowFriends(false)}
          onChat={(f) => { setChatFriend(f); setShowFriends(false) }}
          onRefresh={() => { loadFriends(); loadPendingRequests() }}
        />
      )}

      {/* Chat flottant */}
      {chatFriend && user && (
        <FloatingChat
          user={user}
          friend={chatFriend}
          onClose={() => setChatFriend(null)}
        />
      )}

      {/* Bouton chat flottant si amis */}
      {!chatFriend && friends.length > 0 && user && (
        <div className="fixed bottom-24 right-4 z-40">
          <button onClick={() => setShowFriends(true)}
            className="w-12 h-12 rounded-full bg-[#7b2bff] shadow-lg shadow-[#7b2bff]/40 flex items-center justify-center text-xl hover:scale-105 transition-transform">
            💬
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modal Amis ───────────────────────────────────────────────────────────────
function FriendsModal({ user, friends, pendingRequests, onClose, onChat, onRefresh }: {
  user: { id: string } | null
  friends: Friend[]
  pendingRequests: Friend[]
  onClose: () => void
  onChat: (f: Friend) => void
  onRefresh: () => void
}) {
  const [search, setSearch]   = useState('')
  const [results, setResults] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState<Set<string>>(new Set())

  async function searchUsers(q: string) {
    if (!q.trim() || !user) return
    setLoading(true)
    const { data } = await createClient()
      .from('player_profiles')
      .select('user_id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('user_id', user.id)
      .limit(10)
    setResults(data ?? [])
    setLoading(false)
  }

  async function sendRequest(targetId: string) {
    if (!user) return
    // Vérifier qu'aucune relation n'existe déjà dans un sens ou l'autre
    const sb = createClient()
    const { data: existing } = await sb
      .from('friendships')
      .select('id')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`)
      .limit(1)
    if (existing && existing.length > 0) {
      setSent(s => new Set([...s, targetId]))
      return
    }
    await sb.from('friendships').insert({
      sender_id: user.id, receiver_id: targetId, status: 'pending'
    })
    setSent(s => new Set([...s, targetId]))
  }

  async function removeFriend(friendshipId: number) {
    await createClient().from('friendships').delete().eq('id', friendshipId)
    onRefresh()
  }

  async function acceptRequest(friendshipId: number) {
    await createClient().from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    onRefresh()
  }

  async function declineRequest(friendshipId: number) {
    await createClient().from('friendships').delete().eq('id', friendshipId)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#0a0816] border border-[#7b2bff]/20 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-base">👥 Amis</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
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
                    className="px-2.5 py-1 rounded-lg bg-[#00c896]/20 hover:bg-[#00c896]/35 text-[#00c896] text-xs font-bold">
                    ✓ Accepter
                  </button>
                  <button onClick={() => declineRequest(r.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs font-bold">
                    ✕
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
            🔍
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
                  <span className="text-xs text-[#00c896]">✓ Ami</span>
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
                <button onClick={() => onChat(f)}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs">
                  💬
                </button>
                <button onClick={() => removeFriend(f.id)}
                  className="px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Chat flottant ────────────────────────────────────────────────────────────
function FloatingChat({ user, friend, onClose }: {
  user: { id: string }
  friend: Friend
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sb = createClient()

  const load = useCallback(async () => {
    const { data } = await sb
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.friend_id}),and(sender_id.eq.${friend.friend_id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [user.id, friend.friend_id]) // eslint-disable-line

  useEffect(() => {
    load()
    // Realtime
    const channel = sb
      .channel(`dm-${user.id}-${friend.friend_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => load())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [load]) // eslint-disable-line

  async function send() {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    await sb.from('direct_messages').insert({
      sender_id: user.id, receiver_id: friend.friend_id, content,
    })
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-72 rounded-2xl overflow-hidden shadow-2xl border border-[#7b2bff]/30"
      style={{ background: '#0a0816' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#7b2bff]/15 border-b border-[#7b2bff]/20">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {friend.username?.[0]?.toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-bold text-white truncate">{friend.username}</span>
        <button onClick={() => setMinimized(m => !m)} className="text-white/40 hover:text-white text-xs px-1">
          {minimized ? '▲' : '▼'}
        </button>
        <button onClick={onClose} className="text-white/40 hover:text-white text-xs px-1">✕</button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="h-52 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-white/20 text-xs text-center pt-8">Commencez la conversation !</p>
            )}
            {messages.map(m => {
              const isMe = m.sender_id === user.id
              return (
                <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                  <div className={cn('px-3 py-1.5 rounded-2xl text-xs max-w-[80%] break-words',
                    isMe ? 'bg-[#7b2bff] text-white rounded-tr-sm' : 'bg-white/8 text-white/80 rounded-tl-sm')}>
                    {m.content}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-2 border-t border-white/[0.06]">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message…"
              className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus:border-[#7b2bff]/60 focus:outline-none text-white"
            />
            <button onClick={send}
              className="px-3 py-1.5 rounded-xl bg-[#7b2bff] text-white text-xs font-bold hover:opacity-90">
              →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

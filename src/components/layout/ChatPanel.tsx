'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSocialStore } from '@/store/social'
import { useGameStore } from '@/store/game'
import { Send, X, Search, ArrowLeft, MessageSquare, Swords } from 'lucide-react'
import { RoleBadge, type UserRole } from '@/components/game/RoleBadge'
import { AvatarRing } from '@/components/game/AvatarRing'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: number
  senderId: string
  receiverId: string
  content: string
  createdAt: string
}

interface FriendPreview {
  friendId: string
  username: string | null
  avatarUrl: string | null
  lastMessage: string | null
  lastAt: string | null
  lastFromMe: boolean
  unread: number
  lastSeenAt: string | null
  role?: UserRole
  collectionComplete?: boolean
}

function onlineStatus(lastSeenAt: string | null): { label: string; color: string } {
  if (lastSeenAt) {
    const diff = Date.now() - new Date(lastSeenAt.includes('T') ? lastSeenAt : lastSeenAt.replace(' ', 'T') + 'Z').getTime()
    if (diff < 1 * 60_000)  return { label: 'En ligne',  color: '#22c55e' }
    if (diff < 5 * 60_000)  return { label: 'Récemment', color: '#f59e0b' }
  }
  return { label: 'Hors ligne', color: 'rgba(255,255,255,.3)' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(raw: string | null) {
  if (!raw) return ''
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (now.getTime() - d.getTime() < 86_400_000)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  return <AvatarRing avatarUrl={src} username={name} size={size} />
}

// ── Friend Row ────────────────────────────────────────────────────────────────
function FriendRow({ f, active, onClick }: { f: FriendPreview; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
      style={{
        background: active
          ? 'linear-gradient(135deg,rgba(123,43,255,.22),rgba(74,31,168,.12))'
          : 'transparent',
        borderLeft: active ? '2px solid #7b2bff' : '2px solid transparent',
      }}>
      <div className="relative flex-shrink-0">
        <AvatarRing avatarUrl={f.avatarUrl} username={f.username} size={38} isComplete={f.collectionComplete} />
        {f.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full px-0.5 text-white text-[9px] font-black flex items-center justify-center"
            style={{ background: '#7b2bff', boxShadow: '0 0 10px rgba(123,43,255,.9)' }}>
            {f.unread > 9 ? '9+' : f.unread}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[13px] font-bold truncate transition-colors ${
              active ? 'text-white' : f.unread > 0 ? 'text-white' : 'text-white/55'
            }`}>
              {f.username ?? '???'}
            </span>
            <RoleBadge role={f.role} />
          </div>
          {f.lastAt && (
            <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,.2)' }}>
              {formatTime(f.lastAt)}
            </span>
          )}
        </div>
        {f.lastMessage && (
          <p className="text-[11px] truncate" style={{ color: f.unread > 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.22)' }}>
            {f.lastFromMe && <span style={{ color: 'rgba(255,255,255,.25)' }}>Toi · </span>}
            {parseDuel(f.lastMessage) ? '⚔️ Défi en duel' : f.lastMessage}
          </p>
        )}
      </div>
    </button>
  )
}

// Détecte un message de défi : [[duel:SESSION_ID]]
function parseDuel(content: string): string | null {
  const m = content.match(/^\[\[duel:([0-9a-fA-F-]+)\]\]$/)
  return m ? m[1] : null
}

// Carte de défi avec boutons Accepter / Refuser
function DuelCard({ sessionId, isMe, status, onAccept, onDecline }: {
  sessionId: string; isMe: boolean; status?: 'pending' | 'accepted' | 'declined'; onAccept: () => void; onDecline: () => void
}) {
  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col gap-2.5"
      style={{ background: 'linear-gradient(135deg, rgba(123,43,255,.18), rgba(91,31,200,.12))', border: '1px solid rgba(123,43,255,.35)', minWidth: 200 }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)', boxShadow: '0 0 12px rgba(123,43,255,.5)' }}>
          <Swords size={16} className="text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-bold text-white">Défi en duel</p>
          <p className="text-[11px] text-white/45">Partie amicale</p>
        </div>
      </div>
      {status === 'accepted' ? (
        <p className="text-[11px] text-[#22c55e] font-bold">✓ Duel accepté — en cours</p>
      ) : status === 'declined' ? (
        <p className="text-[11px] text-white/35 italic">✕ Défi refusé</p>
      ) : isMe ? (
        <p className="text-[11px] text-white/40 italic">En attente de sa réponse…</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={onAccept}
            className="flex-1 py-1.5 rounded-xl text-[12px] font-bold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#22c55e,#15803d)', boxShadow: '0 2px 10px rgba(34,197,94,.4)' }}>
            Accepter
          </button>
          <button onClick={onDecline}
            className="flex-1 py-1.5 rounded-xl text-[12px] font-bold text-white/70 transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }}>
            Refuser
          </button>
        </div>
      )}
    </div>
  )
}

// ── Conversation ──────────────────────────────────────────────────────────────
function Conversation({ friend, myId, myProfile, onBack }: {
  friend: FriendPreview
  myId: string
  myProfile: { username?: string | null; avatar_url?: string | null }
  onBack: () => void
}) {
  const router = useRouter()
  const { setChatPanelOpen, chatPanelOpen } = useSocialStore(s => ({ setChatPanelOpen: s.setChatPanelOpen, chatPanelOpen: s.chatPanelOpen }))
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [duelStatus, setDuelStatus] = useState<Record<string, 'accepted' | 'declined'>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  function acceptDuel(sessionId: string) {
    setDuelStatus(s => ({ ...s, [sessionId]: 'accepted' }))
    setChatPanelOpen(false)
    router.push(`/combat/join/${sessionId}`)
  }
  async function declineDuel(sessionId: string) {
    setDuelStatus(s => ({ ...s, [sessionId]: 'declined' }))
    await fetch('/api/social/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: friend.friendId, content: '❌ Défi refusé.' }),
    })
    load(true)
  }

  const load = useCallback(async (scroll = false) => {
    const data: Message[] = await fetch(`/api/social/messages?with=${friend.friendId}&limit=60`)
      .then(r => r.ok ? r.json() : [])
    setMessages(data)
    if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [friend.friendId])

  useEffect(() => {
    fetch('/api/social/messages/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: friend.friendId }),
    }).catch(() => {})
  }, [friend.friendId])

  useEffect(() => {
    load(true)
    inputRef.current?.focus()
    if (!chatPanelOpen) return
    const iv = setInterval(() => load(false), 5000)
    return () => clearInterval(iv)
  }, [load, chatPanelOpen])

  async function send() {
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    setSending(true)
    await fetch('/api/social/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: friend.friendId, content }),
    })
    setSending(false)
    load(true)
  }

  // Group consecutive messages by sender
  type Group = { sender: string; msgs: Message[] }
  const groups: Group[] = []
  for (const m of messages) {
    const last = groups[groups.length - 1]
    if (last && last.sender === m.senderId) last.msgs.push(m)
    else groups.push({ sender: m.senderId, msgs: [m] })
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(123,43,255,.12)', background: 'rgba(123,43,255,.04)' }}>
        <button onClick={onBack} className="sm:hidden text-white/30 hover:text-white transition-colors">
          <ArrowLeft size={17} />
        </button>
        <div className="relative">
          <Avatar src={friend.avatarUrl} name={friend.username} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-bold text-white leading-none">{friend.username}</p>
            <RoleBadge role={friend.role} />
          </div>
          {(() => {
            const status = onlineStatus(friend.lastSeenAt)
            return (
              <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'rgba(168,85,247,.6)' }}>
                Ami <span>·</span> <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: status.color }} /> <span style={{ color: status.color }}>{status.label}</span>
              </p>
            )
          })()}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(123,43,255,.2) transparent' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <MessageSquare size={32} className="text-[#7b2bff]" />
            <p className="text-white text-xs">Commencez la conversation !</p>
          </div>
        )}

        {groups.map((g, gi) => {
          const isMe = g.sender === myId
          return (
            <div key={gi} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar shown once per group */}
              <div className="flex-shrink-0 mt-auto">
                {isMe
                  ? <Avatar src={myProfile.avatar_url} name={myProfile.username} size={28} />
                  : <Avatar src={friend.avatarUrl} name={friend.username} size={28} />
                }
              </div>

              <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                {g.msgs.map((m, mi) => {
                  const duelId = parseDuel(m.content)
                  if (duelId) return (
                    <DuelCard key={m.id} sessionId={duelId} isMe={isMe}
                      status={duelStatus[duelId]}
                      onAccept={() => acceptDuel(duelId)} onDecline={() => declineDuel(duelId)} />
                  )
                  return (
                  <div key={m.id}
                    className={`px-3.5 py-2 text-[13px] leading-relaxed break-words ${
                      isMe
                        ? 'text-white rounded-2xl rounded-tr-sm'
                        : 'text-white/85 rounded-2xl rounded-tl-sm'
                    } ${mi > 0 ? (isMe ? 'rounded-tr-2xl' : 'rounded-tl-2xl') : ''}`}
                    style={isMe
                      ? { background: 'linear-gradient(135deg,#7b2bff,#5b1fc8)', boxShadow: '0 2px 12px rgba(123,43,255,.35)' }
                      : { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.06)' }
                    }>
                    {m.content}
                  </div>
                  )
                })}
                {/* Timestamp on last message of group */}
                <span className="text-[10px] px-1 mt-0.5"
                  style={{ color: 'rgba(255,255,255,.18)' }}>
                  {formatTime(g.msgs[g.msgs.length - 1].createdAt)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(123,43,255,.1)' }}>
        <div className="flex gap-2 items-center rounded-2xl px-3 py-1.5"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(123,43,255,.2)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Tapez votre message ici…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/20 outline-none py-1.5"
          />
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
            style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)', boxShadow: '0 0 12px rgba(123,43,255,.5)' }}>
            <Send size={13} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
export function ChatPanel() {
  const user    = useGameStore(s => s.user)
  const profile = useGameStore(s => s.profile)
  const { chatFriend, setChatFriend, chatPanelOpen, setChatPanelOpen, setUnreadBySender, setUnreadMessageCount, unreadMessageCount } = useSocialStore()

  const [friends, setFriends] = useState<FriendPreview[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadPreviews = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const data: FriendPreview[] = await fetch('/api/social/messages/previews')
      .then(r => r.ok ? r.json() : [])
    setFriends(data)
    const bySender: Record<string, number> = {}
    let total = 0
    for (const f of data) { if (f.unread > 0) { bySender[f.friendId] = f.unread; total += f.unread } }
    setUnreadBySender(bySender)
    setUnreadMessageCount(total)
    setLoading(false)
  }, [user, setUnreadBySender, setUnreadMessageCount])

  useEffect(() => {
    if (!user || !chatPanelOpen) return
    loadPreviews()
    const iv = setInterval(loadPreviews, 20_000)
    return () => clearInterval(iv)
  }, [chatPanelOpen, user, loadPreviews])

  useEffect(() => {
    if (chatPanelOpen) setTimeout(() => searchRef.current?.focus(), 150)
  }, [chatPanelOpen])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setChatPanelOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [setChatPanelOpen])

  if (!user) return null

  const filtered = friends.filter(f =>
    !search || (f.username ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const totalUnread = unreadMessageCount

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setChatPanelOpen(!chatPanelOpen)}
        className="fixed bottom-24 right-4 z-[140] w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          background: chatPanelOpen
            ? 'rgba(123,43,255,.3)'
            : 'linear-gradient(135deg,#7b2bff,#4a1fa8)',
          boxShadow: chatPanelOpen
            ? '0 0 0 1px rgba(123,43,255,.4)'
            : '0 4px 20px rgba(123,43,255,.55), 0 0 0 1px rgba(123,43,255,.3)',
          border: '1px solid rgba(123,43,255,.35)',
        }}>
        {chatPanelOpen
          ? <X size={17} className="text-white/70" />
          : <MessageSquare size={17} className="text-white" />
        }
        {!chatPanelOpen && totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full px-1 text-white text-[9px] font-black flex items-center justify-center"
            style={{ background: '#ff4757', boxShadow: '0 0 8px rgba(255,71,87,.7)' }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {chatPanelOpen && (
        <div className="fixed inset-0 z-[141]" style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setChatPanelOpen(false)} />
      )}

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[142] flex"
        style={{
          width: 'min(580px, 100vw)',
          transform: chatPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .28s cubic-bezier(.32,.72,0,1)',
          pointerEvents: chatPanelOpen ? 'all' : 'none',
        }}>

        <div className="flex w-full h-full"
          style={{
            background: 'linear-gradient(160deg,#0c0518 0%,#07030f 60%,#060212 100%)',
            borderLeft: '1px solid rgba(123,43,255,.18)',
            boxShadow: '-20px 0 60px rgba(0,0,0,.7), -4px 0 20px rgba(123,43,255,.08)',
          }}>

          {/* ── Sidebar friends ─────────────────────────────────── */}
          {/* Sur mobile : masqué si une conv est ouverte */}
          <div
            className={`flex-col flex-shrink-0 h-full ${chatFriend ? 'hidden sm:flex' : 'flex'}`}
            style={{ width: 240, borderRight: '1px solid rgba(123,43,255,.1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(123,43,255,.08)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7b2bff]"
                  style={{ boxShadow: '0 0 6px #7b2bff' }} />
                <span className="text-white font-black text-sm tracking-wide">Messages</span>
              </div>
              <button onClick={() => setChatPanelOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/5 transition-all">
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(123,43,255,.06)' }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'rgba(123,43,255,.07)', border: '1px solid rgba(123,43,255,.15)' }}>
                <Search size={12} style={{ color: 'rgba(168,85,247,.5)' }} className="flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un ami…"
                  className="flex-1 bg-transparent text-xs text-white/70 placeholder:text-white/20 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-white/20 hover:text-white/50 transition-colors">
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(123,43,255,.15) transparent' }}>
              {loading && friends.length === 0 && (
                <div className="flex justify-center pt-10">
                  <div className="w-5 h-5 rounded-full border-2 border-[#7b2bff]/20 border-t-[#7b2bff] animate-spin" />
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-center text-[11px] pt-10 px-4" style={{ color: 'rgba(255,255,255,.18)' }}>
                  {search ? 'Aucun résultat' : 'Aucun ami pour l\'instant'}
                </p>
              )}
              {filtered.map(f => (
                <FriendRow
                  key={f.friendId}
                  f={f}
                  active={chatFriend?.friend_id === f.friendId}
                  onClick={() => {
                    setChatFriend({ friend_id: f.friendId, username: f.username, avatar_url: f.avatarUrl })
                    setFriends(p => p.map(x => x.friendId === f.friendId ? { ...x, unread: 0 } : x))
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Conversation ─────────────────────────────────────── */}
          <div className={`flex flex-col h-full min-w-0 ${chatFriend ? 'flex-1 w-full' : 'flex-1 hidden sm:flex'}`}>
            {chatFriend ? (
              <Conversation
                friend={friends.find(f => f.friendId === chatFriend.friend_id) ?? {
                  friendId: chatFriend.friend_id,
                  username: chatFriend.username,
                  avatarUrl: chatFriend.avatar_url,
                  lastMessage: null, lastAt: null, lastFromMe: false, unread: 0, lastSeenAt: null,
                }}
                myId={user.id}
                myProfile={{ username: profile?.username, avatar_url: profile?.avatar_url }}
                onBack={() => setChatFriend(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(123,43,255,.15)', border: '1px solid rgba(123,43,255,.25)' }}>
                  <MessageSquare size={24} className="text-[#a855f7]" />
                </div>
                <p className="text-white text-xs text-center leading-relaxed">
                  Sélectionne un ami<br />pour commencer à chatter
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

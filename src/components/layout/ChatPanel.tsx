'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocialStore } from '@/store/social'
import { useGameStore } from '@/store/game'
import { Send, X, Search, ArrowLeft, MessageCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: number
  senderId: string
  receiverId: string
  content: string
  createdAt: string
  readAt: string | null
}

interface FriendPreview {
  friendId: string
  username: string | null
  avatarUrl: string | null
  lastMessage: string | null
  lastAt: string | null
  lastFromMe: boolean
  unread: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(raw: string | null) {
  if (!raw) return ''
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86_400_000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Friend Row ────────────────────────────────────────────────────────────────
function FriendRow({ f, active, onClick }: { f: FriendPreview; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
      style={{
        background: active ? 'rgba(123,43,255,.18)' : 'transparent',
        border: `1px solid ${active ? 'rgba(123,43,255,.35)' : 'transparent'}`,
      }}>
      {/* Avatar + online dot */}
      <div className="relative flex-shrink-0">
        <Avatar src={f.avatarUrl} name={f.username} size={38} />
        {f.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#7b2bff] text-white text-[9px] font-black flex items-center justify-center"
            style={{ boxShadow: '0 0 8px rgba(123,43,255,.8)' }}>
            {f.unread > 9 ? '9+' : f.unread}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-semibold truncate ${f.unread > 0 ? 'text-white' : 'text-white/70'} group-hover:text-white transition-colors`}>
            {f.username ?? '???'}
          </span>
          {f.lastAt && (
            <span className="text-[10px] text-white/25 flex-shrink-0">{formatTime(f.lastAt)}</span>
          )}
        </div>
        {f.lastMessage && (
          <p className={`text-xs truncate mt-0.5 ${f.unread > 0 ? 'text-white/60' : 'text-white/30'}`}>
            {f.lastFromMe ? <span className="text-white/30">Toi: </span> : null}
            {f.lastMessage}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Conversation ──────────────────────────────────────────────────────────────
function Conversation({ friend, myId, myProfile, onBack }: {
  friend: FriendPreview
  myId: string
  myProfile: { username?: string | null; avatar_url?: string | null }
  onBack: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const lastIdRef = useRef(0)

  const load = useCallback(async (scroll = false) => {
    const data: Message[] = await fetch(`/api/social/messages?with=${friend.friendId}&limit=60`)
      .then(r => r.ok ? r.json() : [])
    setMessages(data)
    const maxId = Math.max(0, ...data.map(m => m.id))
    lastIdRef.current = maxId
    if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [friend.friendId])

  // Mark as read when opening conversation
  useEffect(() => {
    fetch('/api/social/messages/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: friend.friendId }),
    }).catch(() => {})
  }, [friend.friendId])

  useEffect(() => {
    load(true)
    inputRef.current?.focus()
    const iv = setInterval(() => load(false), 3000)
    return () => clearInterval(iv)
  }, [load])

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 flex-shrink-0">
        <button onClick={onBack}
          className="md:hidden text-white/40 hover:text-white transition-colors mr-1">
          <ArrowLeft size={18} />
        </button>
        <Avatar src={friend.avatarUrl} name={friend.username} size={34} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{friend.username}</p>
          <p className="text-[11px] text-white/30">Ami</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-white/20 text-xs text-center pt-12">Aucun message — dites bonjour !</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.senderId === myId
          const prev = messages[i - 1]
          const showAvatar = !isMe && (i === 0 || prev?.senderId !== m.senderId)
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-7 flex-shrink-0 flex items-end">
                {showAvatar && !isMe && <Avatar src={friend.avatarUrl} name={friend.username} size={26} />}
              </div>
              <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                  isMe
                    ? 'bg-[#7b2bff] text-white rounded-tr-sm'
                    : 'bg-white/8 text-white/85 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
                {(i === messages.length - 1 || messages[i + 1]?.senderId !== m.senderId) && (
                  <span className="text-[10px] text-white/20 mt-1 px-1">{formatTime(m.createdAt)}</span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-white/6 flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Tapez votre message ici…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/25 focus:border-[#7b2bff]/50 focus:outline-none transition-colors"
        />
        <button onClick={send} disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
export function ChatPanel() {
  const user    = useGameStore(s => s.user)
  const profile = useGameStore(s => s.profile)
  const { chatFriend, setChatFriend, chatPanelOpen, setChatPanelOpen, setUnreadBySender, setUnreadMessageCount } = useSocialStore()

  const [friends, setFriends]   = useState<FriendPreview[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadPreviews = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const data: FriendPreview[] = await fetch('/api/social/messages/previews')
      .then(r => r.ok ? r.json() : [])
    setFriends(data)
    // Sync unread to store
    const bySender: Record<string, number> = {}
    let total = 0
    for (const f of data) { if (f.unread > 0) { bySender[f.friendId] = f.unread; total += f.unread } }
    setUnreadBySender(bySender)
    setUnreadMessageCount(total)
    setLoading(false)
  }, [user, setUnreadBySender, setUnreadMessageCount])

  useEffect(() => {
    if (!chatPanelOpen || !user) return
    loadPreviews()
    const iv = setInterval(loadPreviews, 8000)
    return () => clearInterval(iv)
  }, [chatPanelOpen, user, loadPreviews])

  useEffect(() => {
    if (chatPanelOpen) setTimeout(() => searchRef.current?.focus(), 100)
  }, [chatPanelOpen])

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setChatPanelOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [setChatPanelOpen])

  if (!user) return null

  const filtered = friends.filter(f =>
    !search || (f.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = friends.reduce((s, f) => s + f.unread, 0)

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setChatPanelOpen(!chatPanelOpen)}
        className="fixed bottom-24 right-4 z-[140] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: chatPanelOpen
            ? 'rgba(123,43,255,.4)'
            : 'linear-gradient(135deg,#7b2bff,#4a1fa8)',
          boxShadow: '0 4px 20px rgba(123,43,255,.5)',
          border: '1px solid rgba(123,43,255,.4)',
        }}>
        {chatPanelOpen
          ? <X size={20} className="text-white" />
          : <MessageCircle size={20} className="text-white" />
        }
        {!chatPanelOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff4757] text-white text-[10px] font-black flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {chatPanelOpen && (
        <div className="fixed inset-0 z-[141] bg-black/30 backdrop-blur-[2px]"
          onClick={() => setChatPanelOpen(false)} />
      )}

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-[142] flex transition-all duration-300 ease-out"
        style={{
          transform: chatPanelOpen ? 'translateX(0)' : 'translateX(100%)',
          width: 'min(560px, 100vw)',
          pointerEvents: chatPanelOpen ? 'all' : 'none',
        }}>

        <div className="flex w-full h-full shadow-2xl"
          style={{ background: '#08040f', borderLeft: '1px solid rgba(123,43,255,.15)' }}>

          {/* ── Friends list ── */}
          <div className="flex flex-col w-64 flex-shrink-0 border-r border-white/6 h-full"
            style={{ display: chatFriend && window.innerWidth < 500 ? 'none' : undefined }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/6 flex-shrink-0">
              <span className="text-white font-black text-sm">Messages</span>
              <button onClick={() => setChatPanelOpen(false)}
                className="text-white/30 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-white/6 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 focus-within:border-[#7b2bff]/40 transition-colors">
                <Search size={13} className="text-white/30 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un ami…"
                  className="flex-1 bg-transparent text-xs text-white placeholder-white/25 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-white/30 hover:text-white/60">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loading && friends.length === 0 && (
                <div className="flex items-center justify-center pt-10">
                  <div className="w-5 h-5 border-2 border-[#7b2bff]/20 border-t-[#7b2bff] rounded-full animate-spin" />
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-white/20 text-xs text-center pt-8 px-4">
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
                    // Optimistically clear unread
                    setFriends(prev => prev.map(p => p.friendId === f.friendId ? { ...p, unread: 0 } : p))
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Conversation area ── */}
          <div className="flex-1 flex flex-col h-full min-w-0">
            {chatFriend ? (
              <Conversation
                friend={friends.find(f => f.friendId === chatFriend.friend_id) ?? {
                  friendId: chatFriend.friend_id,
                  username: chatFriend.username,
                  avatarUrl: chatFriend.avatar_url,
                  lastMessage: null, lastAt: null, lastFromMe: false, unread: 0,
                }}
                myId={user.id}
                myProfile={{ username: profile?.username, avatar_url: profile?.avatar_url }}
                onBack={() => setChatFriend(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(123,43,255,.12)', border: '1px solid rgba(123,43,255,.2)' }}>
                  <MessageCircle size={28} className="text-[#7b2bff]/60" />
                </div>
                <p className="text-white/30 text-sm">Sélectionne un ami<br />pour commencer à chatter</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

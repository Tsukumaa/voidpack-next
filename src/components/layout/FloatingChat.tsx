'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Send, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useSocialStore } from '@/store/social'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'

interface Message {
  id: number
  senderId: string
  receiverId: string
  content: string
  createdAt: string
}

function formatTime(raw: string) {
  if (!raw) return ''
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" — not ISO, needs T + Z
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ src, name, size = 24 }: { src?: string | null; name?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function FloatingChat() {
  const user    = useGameStore(s => s.user)
  const profile = useGameStore(s => s.profile)
  const chatFriend    = useSocialStore(s => s.chatFriend)
  const setChatFriend = useSocialStore(s => s.setChatFriend)
  const addToast      = useSocialStore(s => s.addToast)

  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [minimized, setMinimized] = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const lastIdRef   = useRef<number>(0)
  const isFirstLoad = useRef(true)

  const [pos, setPos]    = useState<{ x: number; y: number } | null>(null)
  const dragRef          = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const containerRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chatFriend) return
    // Position: bottom-center-right, with margin from edges
    setPos(p => p ?? {
      x: Math.max(16, window.innerWidth - 360),
      y: Math.max(16, window.innerHeight - 460),
    })
    setMessages([])
    lastIdRef.current = 0
    isFirstLoad.current = true
  }, [chatFriend])

  const load = useCallback(async () => {
    if (!chatFriend || !user) return
    const data: Message[] = await fetch(`/api/social/messages?with=${chatFriend.friend_id}&limit=50`).then(r => r.ok ? r.json() : [])
    if (!data?.length) return

    setMessages(data)

    const maxId = Math.max(...data.map(m => m.id))
    if (!isFirstLoad.current && maxId > lastIdRef.current) {
      const newMsgs = data.filter(m => m.id > lastIdRef.current && m.senderId !== user.id)
      if (newMsgs.length > 0 && minimized) {
        addToast({ type: 'info', title: `💬 ${chatFriend.username}`, body: newMsgs[newMsgs.length - 1].content })
      }
    }
    lastIdRef.current = maxId
    isFirstLoad.current = false

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [chatFriend, user, minimized, addToast])

  useEffect(() => {
    if (!chatFriend) return
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load, chatFriend])

  async function send() {
    if (!input.trim() || !chatFriend) return
    const content = input.trim()
    setInput('')
    await fetch('/api/social/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: chatFriend.friend_id, content }),
    })
    load()
  }

  function onDragStart(e: React.MouseEvent) {
    if (!pos) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, dragRef.current.startPosX + ev.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.startPosY + ev.clientY - dragRef.current.startY)),
      })
    }
    function onUp() { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (!chatFriend || !user || !pos) return null

  const myAvatar = profile?.avatar_url
  const myName   = profile?.username ?? 'Moi'

  return (
    <div ref={containerRef}
      className="fixed z-[150] w-72 rounded-2xl overflow-hidden shadow-2xl border border-[#7b2bff]/30 select-none"
      style={{ background: '#0a0816', left: pos.x, top: pos.y }}>

      {/* Header draggable */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#7b2bff]/15 border-b border-[#7b2bff]/20 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}>
        <GripVertical size={13} className="text-white/20 flex-shrink-0" />
        <Avatar src={chatFriend.avatar_url} name={chatFriend.username} size={22} />
        <span className="flex-1 text-sm font-bold text-white truncate">{chatFriend.username}</span>
        <button onClick={() => setMinimized(m => !m)} className="text-white/40 hover:text-white px-1">
          {minimized ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button onClick={() => setChatFriend(null)} className="text-white/40 hover:text-white px-1">
          <X size={13} />
        </button>
      </div>

      {!minimized && (
        <>
          <div className="h-56 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-white/20 text-xs text-center pt-8">Commencez la conversation !</p>
            )}
            {messages.map((m) => {
              const isMe = m.senderId === user.id
              const name = isMe ? myName : (chatFriend.username ?? '')
              const avatar = isMe ? myAvatar : chatFriend.avatar_url
              return (
                <div key={m.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                  <Avatar src={avatar} name={name} size={22} />
                  <div className={cn('flex flex-col max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                    <span className="text-[10px] text-white/30 mb-0.5 px-0.5">{name}</span>
                    <div className={cn('px-3 py-1.5 rounded-2xl text-xs break-words',
                      isMe ? 'bg-[#7b2bff] text-white rounded-tr-sm' : 'bg-white/8 text-white/80 rounded-tl-sm')}>
                      {m.content}
                    </div>
                    <span className="text-[9px] text-white/20 mt-0.5 px-0.5">{formatTime(m.createdAt)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 p-2 border-t border-white/[0.06]">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message…"
              className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus:border-[#7b2bff]/60 focus:outline-none text-white" />
            <button onClick={send}
              className="px-3 py-1.5 rounded-xl bg-[#7b2bff] text-white text-xs font-bold hover:opacity-90">
              <Send size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

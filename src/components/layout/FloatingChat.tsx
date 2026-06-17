'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Send, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useSocialStore } from '@/store/social'
import { useGameStore } from '@/store/game'
import { cn } from '@/lib/utils'

interface Message {
  id: number
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

export function FloatingChat() {
  const user      = useGameStore(s => s.user)
  const chatFriend = useSocialStore(s => s.chatFriend)
  const setChatFriend = useSocialStore(s => s.setChatFriend)

  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Drag state
  const [pos, setPos]       = useState<{ x: number; y: number } | null>(null)
  const dragRef             = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const containerRef        = useRef<HTMLDivElement>(null)

  // Init position bottom-right
  useEffect(() => {
    if (!chatFriend) return
    setPos(p => p ?? { x: window.innerWidth - 300, y: window.innerHeight - 380 })
  }, [chatFriend])

  const load = useCallback(async () => {
    if (!chatFriend || !user) return
    const data = await fetch(`/api/social/messages?with=${chatFriend.friend_id}&limit=50`).then(r => r.ok ? r.json() : [])
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [chatFriend, user])

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

  // Drag handlers
  function onDragStart(e: React.MouseEvent) {
    const el = containerRef.current
    if (!el || !pos) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, dragRef.current.startPosX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.startPosY + dy)),
      })
    }
    function onUp() {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (!chatFriend || !user || !pos) return null

  return (
    <div
      ref={containerRef}
      className="fixed z-[150] w-72 rounded-2xl overflow-hidden shadow-2xl border border-[#7b2bff]/30 select-none"
      style={{ background: '#0a0816', left: pos.x, top: pos.y }}
    >
      {/* Header draggable */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-[#7b2bff]/15 border-b border-[#7b2bff]/20 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <GripVertical size={13} className="text-white/20 flex-shrink-0" />
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {chatFriend.username?.[0]?.toUpperCase()}
        </div>
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
              <Send size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

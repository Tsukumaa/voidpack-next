'use client'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ToastOverlay } from '@/components/layout/ToastOverlay'
import { ChatPanel } from '@/components/layout/ChatPanel'

export function GlobalOverlay() {
  const user    = useGameStore(s => s.user)
  const { setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, addToast } = useSocialStore()
  const prevCountRef   = useRef<number>(-1)
  const prevUnreadRef  = useRef<number>(0)
  const prevTradeRef   = useRef<number>(0)

  useEffect(() => {
    if (!user) return

    async function checkPending() {
      const data = await fetch('/api/social/friends/pending').then(r => r.ok ? r.json() : []).catch(() => [])
      const count = Array.isArray(data) ? data.length : 0
      setPendingFriendCount(count)

      if (prevCountRef.current >= 0 && count > prevCountRef.current) {
        const newest = data[0]
        addToast({
          type: 'friend_request',
          title: 'Demande d\'ami reçue',
          body: newest?.username ? `${newest.username} veut t'ajouter en ami.` : undefined,
          action: { label: 'Voir', href: '/communaute' },
        })
      }
      prevCountRef.current = count
    }

    async function checkUnread() {
      const data = await fetch('/api/social/messages/unread').then(r => r.ok ? r.json() : { count: 0, bySender: {} }).catch(() => ({ count: 0, bySender: {} }))
      const count = data.count ?? 0
      setUnreadMessageCount(count)
      setUnreadBySender(data.bySender ?? {})

      if (prevUnreadRef.current < count) {
        // toast géré par FloatingChat si chat ouvert — sinon pastille suffit
      }
      prevUnreadRef.current = count
    }

    checkPending()
    checkUnread()
    async function checkTrades() {
      const data = await fetch('/api/trade?status=pending').then(r => r.ok ? r.json() : []).catch(() => [])
      const incoming = (data as { receiverId: string }[]).filter(t => t.receiverId === user!.id).length
      setPendingTradeCount(incoming)
      if (prevTradeRef.current >= 0 && incoming > prevTradeRef.current) {
        addToast({ type: 'info', title: '🔄 Nouveau trade reçu', body: 'Quelqu\'un te propose un échange.', action: { label: 'Voir', href: '/communaute' } })
      }
      prevTradeRef.current = incoming
    }

    checkPending()
    checkUnread()
    checkTrades()
    const i1 = setInterval(checkPending, 30_000)
    const i2 = setInterval(checkUnread, 10_000)
    const i3 = setInterval(checkTrades, 30_000)
    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3) }
  }, [user, setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, addToast])

  return (
    <>
      <ToastOverlay />
      <ChatPanel />
    </>
  )
}

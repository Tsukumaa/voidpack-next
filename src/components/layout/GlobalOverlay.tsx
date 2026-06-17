'use client'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ToastOverlay } from '@/components/layout/ToastOverlay'
import { FloatingChat } from '@/components/layout/FloatingChat'

export function GlobalOverlay() {
  const user    = useGameStore(s => s.user)
  const { setPendingFriendCount, addToast } = useSocialStore()
  const prevCountRef = useRef<number>(-1)

  useEffect(() => {
    if (!user) return

    async function checkPending() {
      const data = await fetch('/api/social/friends/pending').then(r => r.ok ? r.json() : []).catch(() => [])
      const count = Array.isArray(data) ? data.length : 0
      setPendingFriendCount(count)

      // Toast si nouvelles demandes depuis la dernière vérification
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

    checkPending()
    const interval = setInterval(checkPending, 30_000)
    return () => clearInterval(interval)
  }, [user, setPendingFriendCount, addToast])

  return (
    <>
      <ToastOverlay />
      <FloatingChat />
    </>
  )
}

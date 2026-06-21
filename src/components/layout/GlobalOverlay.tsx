'use client'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ToastOverlay } from '@/components/layout/ToastOverlay'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { ChallengePopup, type PendingChallenge } from '@/components/layout/ChallengePopup'

export function GlobalOverlay() {
  const user    = useGameStore(s => s.user)
  const { setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, setStreak, addToast } = useSocialStore()
  const prevFriendsRef   = useRef<number>(-1)
  const prevTradeRef     = useRef<number>(0)
  const seenChallenges   = useRef<Set<string>>(new Set())
  const [activeChallenge, setActiveChallenge] = useState<PendingChallenge | null>(null)

  useEffect(() => {
    if (!user) return

    async function poll() {
      const data = await fetch('/api/social/activity').then(r => r.ok ? r.json() : null).catch(() => null)
      if (!data) return

      // Amis
      setPendingFriendCount(data.pendingFriendCount)
      if (prevFriendsRef.current >= 0 && data.pendingFriendCount > prevFriendsRef.current) {
        addToast({ type: 'friend_request', title: "Demande d'ami reçue", action: { label: 'Voir', href: '/communaute' } })
      }
      prevFriendsRef.current = data.pendingFriendCount

      // Messages
      setUnreadMessageCount(data.unreadMessageCount)
      setUnreadBySender(data.unreadBySender)

      // Trades
      setPendingTradeCount(data.pendingTradeCount)
      if (prevTradeRef.current >= 0 && data.pendingTradeCount > prevTradeRef.current) {
        addToast({ type: 'info', title: '🔄 Nouveau trade reçu', body: "Quelqu'un te propose un échange.", action: { label: 'Voir', href: '/communaute' } })
      }
      prevTradeRef.current = data.pendingTradeCount

      // Défis
      for (const c of (data.challenges ?? [])) {
        if (seenChallenges.current.has(c.id)) continue
        seenChallenges.current.add(c.id)
        setActiveChallenge({ id: c.id, challengerId: c.challengerId, challengerUsername: c.challengerUsername ?? null })
      }

      // Badge profil + streak
      setProfilBadge(data.profilBadge)
      if (data.streak) setStreak(data.streak.currentStreak)
    }

    function pingPresence() {
      fetch('/api/social/presence', { method: 'POST' }).catch(() => {})
    }

    poll()
    pingPresence()
    const i1 = setInterval(poll, 15_000)
    const i2 = setInterval(pingPresence, 60_000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [user, setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, setStreak, addToast])

  return (
    <>
      <ToastOverlay />
      <ChatPanel />
      {activeChallenge && (
        <ChallengePopup
          challenge={activeChallenge}
          onDone={() => setActiveChallenge(null)}
        />
      )}
    </>
  )
}

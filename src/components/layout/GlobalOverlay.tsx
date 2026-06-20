'use client'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ToastOverlay } from '@/components/layout/ToastOverlay'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { ChallengePopup, type PendingChallenge } from '@/components/layout/ChallengePopup'
import { MusicPlayer } from '@/components/layout/MusicPlayer'
import { SettingsButton } from '@/components/layout/SettingsButton'

export function GlobalOverlay() {
  const user    = useGameStore(s => s.user)
  const { setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, addToast } = useSocialStore()
  const prevCountRef   = useRef<number>(-1)
  const prevUnreadRef  = useRef<number>(0)
  const prevTradeRef   = useRef<number>(0)
  const seenChallenges = useRef<Set<string>>(new Set())
  const [activeChallenge, setActiveChallenge] = useState<PendingChallenge | null>(null)

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
          title: "Demande d'ami reçue",
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
      prevUnreadRef.current = count
    }

    async function checkTrades() {
      const data = await fetch('/api/trade?status=pending').then(r => r.ok ? r.json() : []).catch(() => [])
      const incoming = (data as { receiverId: string }[]).filter(t => t.receiverId === user!.id).length
      setPendingTradeCount(incoming)
      if (prevTradeRef.current >= 0 && incoming > prevTradeRef.current) {
        addToast({ type: 'info', title: '🔄 Nouveau trade reçu', body: "Quelqu'un te propose un échange.", action: { label: 'Voir', href: '/communaute' } })
      }
      prevTradeRef.current = incoming
    }

    async function checkChallenges() {
      const data = await fetch('/api/combat/challenges?status=pending').then(r => r.ok ? r.json() : []).catch(() => [])
      for (const c of (data as { id: string; challengerId: string; challengerUsername?: string | null }[])) {
        if (seenChallenges.current.has(c.id)) continue
        seenChallenges.current.add(c.id)
        // Popup modale immédiate
        setActiveChallenge({
          id: c.id,
          challengerId: c.challengerId,
          challengerUsername: c.challengerUsername ?? null,
        })
      }
    }

    async function checkProfilBadge() {
      const [missionsData, streakData] = await Promise.all([
        fetch('/api/profile/missions').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/profile/streak').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      const unclaimed = (missionsData as { completed: boolean; claimed: boolean }[]).filter(m => m.completed && !m.claimed).length
      const lastMs = streakData?.lastClaimAt ? new Date(streakData.lastClaimAt).getTime() : 0
      const dailyAvail = Date.now() - lastMs > 20 * 3600 * 1000 ? 1 : 0
      setProfilBadge(unclaimed + dailyAvail)
    }

    function pingPresence() {
      fetch('/api/social/presence', { method: 'POST' }).catch(() => {})
    }

    checkChallenges()
    checkPending()
    checkUnread()
    checkTrades()
    checkProfilBadge()
    pingPresence()
    const i1 = setInterval(checkPending, 30_000)
    const i2 = setInterval(checkUnread, 10_000)
    const i3 = setInterval(checkTrades, 30_000)
    const i4 = setInterval(pingPresence, 60_000)
    const i5 = setInterval(checkChallenges, 5_000)
    const i6 = setInterval(checkProfilBadge, 60_000)
    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); clearInterval(i5); clearInterval(i6) }
  }, [user, setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, addToast])

  return (
    <>
      <MusicPlayer />
      <ToastOverlay />
      <SettingsButton />
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

'use client'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { X, Megaphone } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { useSocialStore } from '@/store/social'
import { ToastOverlay } from '@/components/layout/ToastOverlay'
import { ChallengePopup, type PendingChallenge } from '@/components/layout/ChallengePopup'
import { useIdleDetection } from '@/hooks/useIdleDetection'

interface AnnouncementSection { subtitle: string; text: string }
interface Announcement { title: string; sections: AnnouncementSection[]; since: string }

export function GlobalOverlay() {
  const user    = useGameStore(s => s.user)
  const { setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, setStreak, addToast } = useSocialStore()
  const prevFriendsRef   = useRef<number>(-1)
  const prevTradeRef     = useRef<number>(0)
  const seenChallenges   = useRef<Set<string>>(new Set())
  const [activeChallenge, setActiveChallenge] = useState<PendingChallenge | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const idle = useIdleDetection()

  // Popup d'annonce — affichée une seule fois par activation
  const fetchAnnouncement = () => {
    fetch('/api/announcement').then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.active) return
      try {
        const seen = localStorage.getItem('announcement_seen')
        if (seen === data.since) return
        let sections: AnnouncementSection[] = []
        try { sections = JSON.parse(data.body) } catch { sections = [{ subtitle: '', text: data.body ?? '' }] }
        setAnnouncement({ title: data.title, sections, since: data.since })
      } catch { /* localStorage indisponible */ }
    }).catch(() => {})
  }

  useEffect(() => {
    fetchAnnouncement()
    window.addEventListener('show-announcement', fetchAnnouncement)
    return () => window.removeEventListener('show-announcement', fetchAnnouncement)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!user) return

    async function poll() {
      const data = await fetch('/api/social/activity').then(r => r.ok ? r.json() : null).catch(() => null)
      if (!data) return

      setPendingFriendCount(data.pendingFriendCount)
      if (prevFriendsRef.current >= 0 && data.pendingFriendCount > prevFriendsRef.current) {
        addToast({ type: 'friend_request', title: "Demande d'ami reçue", action: { label: 'Voir', href: '/communaute' } })
      }
      prevFriendsRef.current = data.pendingFriendCount

      setUnreadMessageCount(data.unreadMessageCount)
      setUnreadBySender(data.unreadBySender)

      setPendingTradeCount(data.pendingTradeCount)
      if (prevTradeRef.current >= 0 && data.pendingTradeCount > prevTradeRef.current) {
        addToast({ type: 'info', title: '🔄 Nouveau trade reçu', body: "Quelqu'un te propose un échange.", action: { label: 'Voir', href: '/communaute' } })
      }
      prevTradeRef.current = data.pendingTradeCount

      for (const c of (data.challenges ?? [])) {
        if (seenChallenges.current.has(c.id)) continue
        seenChallenges.current.add(c.id)
        setActiveChallenge({ id: c.id, challengerId: c.challengerId, challengerUsername: c.challengerUsername ?? null })
      }

      setProfilBadge(data.profilBadge)
      if (data.streak) setStreak(data.streak.currentStreak)
    }

    function pingPresence() {
      fetch('/api/social/presence', { method: 'POST' }).catch(() => {})
    }

    let pollTimer: ReturnType<typeof setTimeout>
    function scheduleNextPoll() {
      const delay = document.visibilityState === 'visible' ? 60_000 : 300_000
      pollTimer = setTimeout(async () => { await poll(); scheduleNextPoll() }, delay)
    }

    poll()
    pingPresence()
    scheduleNextPoll()
    const i2 = setInterval(pingPresence, 60_000)

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        clearTimeout(pollTimer)
        poll()
        scheduleNextPoll()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(pollTimer)
      clearInterval(i2)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, setPendingFriendCount, setUnreadMessageCount, setUnreadBySender, setPendingTradeCount, setProfilBadge, setStreak, addToast])

  return (
    <>
      <ToastOverlay />
      {/* Écran d'inactivité */}
      {idle && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ background: 'rgba(4,3,12,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="flex flex-col items-center gap-3 text-center select-none">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
              style={{ background: 'rgba(123,43,255,0.12)', border: '1px solid rgba(123,43,255,0.25)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <p className="text-white/60 text-sm font-bold tracking-wide">En veille</p>
            <p className="text-white/30 text-xs">Bouge ta souris pour reprendre</p>
          </div>
        </div>
      )}
      {activeChallenge && (
        <ChallengePopup
          challenge={activeChallenge}
          onDone={() => setActiveChallenge(null)}
        />
      )}
      {announcement && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-[#7b2bff]/30 p-6 flex flex-col gap-4"
            style={{ background: '#0b0816', boxShadow: '0 0 60px rgba(123,43,255,0.2)' }}>
            <button
              onClick={() => {
                try { localStorage.setItem('announcement_seen', announcement.since) } catch { /* */ }
                setAnnouncement(null)
              }}
              className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                <Megaphone size={18} className="text-white" />
              </div>
              <h2 className="text-white font-black text-base leading-tight">{announcement.title}</h2>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {announcement.sections.map((s, i) => (
                <div key={i}>
                  {s.subtitle && <p className="text-white font-bold text-sm mb-1">{s.subtitle}</p>}
                  {s.text && <p className="text-white/55 text-sm leading-relaxed whitespace-pre-wrap">{s.text}</p>}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                try { localStorage.setItem('announcement_seen', announcement.since) } catch { /* */ }
                setAnnouncement(null)
              }}
              className="w-full py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              J&apos;ai compris !
            </button>
          </div>
        </div>
      )}
    </>
  )
}

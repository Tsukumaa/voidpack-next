'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Swords, X, Check } from 'lucide-react'

export interface PendingChallenge {
  id: string
  challengerId: string
  challengerUsername: string | null
}

export function ChallengePopup({
  challenge,
  onDone,
}: {
  challenge: PendingChallenge
  onDone: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  async function accept() {
    setLoading('accept')
    // Redirige vers le draft avec le challenge_id en param (le draft sauvegardera le deck et acceptera)
    sessionStorage.setItem('pending_challenge_id', challenge.id)
    sessionStorage.setItem('challenge_friend', JSON.stringify({ id: challenge.challengerId, username: challenge.challengerUsername }))
    onDone()
    router.push(`/combat/draft?mode=friendly&challenge=${challenge.id}`)
  }

  async function decline() {
    setLoading('decline')
    await fetch(`/api/combat/challenges/${challenge.id}/decline`, { method: 'POST' }).catch(() => {})
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#7b2bff]/40 p-6 flex flex-col items-center gap-5"
        style={{ background: '#0b0816', boxShadow: '0 0 60px rgba(123,43,255,0.3), 0 0 0 1px rgba(123,43,255,0.15)' }}
      >
        {/* icône */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)', boxShadow: '0 0 30px rgba(123,43,255,0.5)' }}
        >
          <Swords size={28} className="text-white" />
        </div>

        {/* texte */}
        <div className="text-center">
          <p className="text-white font-black text-lg">Défi reçu !</p>
          <p className="text-white/50 text-sm mt-1">
            <span className="text-[#a78bfa] font-bold">{challenge.challengerUsername ?? 'Quelqu\'un'}</span>
            {' '}te défie en duel.
          </p>
          <p className="text-white/30 text-xs mt-2">Construis ton deck pour accepter.</p>
        </div>

        {/* boutons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={decline}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            <X size={15} /> Refuser
          </button>
          <button
            onClick={accept}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}
          >
            {loading === 'accept'
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Check size={15} /> Accepter</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

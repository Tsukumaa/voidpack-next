'use client'
import { useEffect } from 'react'
import { X, Users, Target, Flame } from 'lucide-react'
import { useSocialStore, type Toast } from '@/store/social'
import Link from 'next/link'

const ICONS = {
  friend_request: <Users size={16} className="text-[#a78bfa]" />,
  mission:        <Target size={16} className="text-[#4a9e6a]" />,
  streak:         <Flame size={16} className="text-orange-400" />,
  info:           null,
}

const COLORS = {
  friend_request: '#7b2bff',
  mission:        '#4a9e6a',
  streak:         '#f97316',
  info:           '#ffffff',
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useSocialStore(s => s.removeToast)
  const color = COLORS[toast.type]

  useEffect(() => {
    const t = setTimeout(() => removeToast(toast.id), 6000)
    return () => clearTimeout(t)
  }, [toast.id, removeToast])

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-right-4 fade-in duration-300"
      style={{
        background: '#0d0a1f',
        borderColor: color + '40',
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
        minWidth: 240,
        maxWidth: 300,
      }}
    >
      <div className="mt-0.5 flex-shrink-0">{ICONS[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold leading-tight">{toast.title}</p>
        {toast.body && <p className="text-white/50 text-xs mt-0.5 leading-snug">{toast.body}</p>}
        {toast.action && (
          toast.action.href ? (
            <Link href={toast.action.href}
              className="inline-block mt-2 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
              style={{ background: color + '25', color }}
              onClick={() => removeToast(toast.id)}>
              {toast.action.label}
            </Link>
          ) : (
            <button
              onClick={() => { toast.action?.onClick?.(); removeToast(toast.id) }}
              className="mt-2 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
              style={{ background: color + '25', color }}>
              {toast.action.label}
            </button>
          )
        )}
      </div>
      <button onClick={() => removeToast(toast.id)} className="text-white/20 hover:text-white/60 mt-0.5 flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}

export function ToastOverlay() {
  const toasts = useSocialStore(s => s.toasts)
  if (!toasts.length) return null

  return (
    <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}

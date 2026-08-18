'use client'
import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_notice')) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookie_notice', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-[520px]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[18px] bg-[rgba(8,10,18,0.92)] backdrop-blur-2xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-[12px] text-white/50">
        <p>
          Ce site utilise uniquement un cookie de session nécessaire à votre connexion.{' '}
          <a href="/confidentialite" className="text-purple-400 hover:underline">En savoir plus</a>
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-[rgba(123,43,255,0.2)] hover:bg-[rgba(123,43,255,0.35)] text-purple-300 font-bold transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  )
}

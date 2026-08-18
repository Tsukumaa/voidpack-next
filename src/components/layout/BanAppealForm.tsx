'use client'
import { useState } from 'react'

export function BanAppealForm({ hasAppeal: initialHasAppeal }: { hasAppeal: boolean }) {
  const [hasAppeal, setHasAppeal] = useState(initialHasAppeal)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hovered, setHovered] = useState(false)

  async function submit() {
    if (message.trim().length < 10) { setError('Message trop court (min. 10 caractères).'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/account/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return }
      setHasAppeal(true)
      setShowForm(false)
    } catch { setError('Erreur réseau') }
    finally { setLoading(false) }
  }

  if (hasAppeal) {
    return (
      <div style={{
        background: 'rgba(74,158,106,0.08)',
        border: '1px solid rgba(74,158,106,0.2)',
        borderRadius: 12, padding: '12px 16px',
        fontSize: 13, color: 'rgba(110,231,160,0.8)',
        lineHeight: 1.6,
      }}>
        ✓ Demande envoyée. Un administrateur la traitera dans les meilleurs délais.
      </div>
    )
  }

  if (showForm) {
    return (
      <div style={{ textAlign: 'left' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
          Explique pourquoi tu penses que ce ban est injustifié. Cette demande est unique et définitive.
        </p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Ton message…"
          style={{
            width: '100%', resize: 'vertical',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff',
            fontSize: 13, padding: '10px 12px',
            outline: 'none', marginBottom: 8,
            fontFamily: 'inherit',
          }}
        />
        {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowForm(false); setError('') }}
            disabled={loading}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              flex: 2, padding: '10px', borderRadius: 10,
              background: 'rgba(123,43,255,0.25)',
              border: '1px solid rgba(123,43,255,0.4)',
              color: '#c4b5fd', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 16 }}>
        Tu penses que c'est une erreur ? Tu peux soumettre une demande d'annulation.
      </p>
      <button
        onClick={() => setShowForm(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%', padding: '12px 16px',
          background: hovered ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.2)',
          border: `1px solid ${hovered ? 'rgba(220,38,38,0.7)' : 'rgba(220,38,38,0.45)'}`,
          borderRadius: 12, color: hovered ? '#fff' : '#fca5a5',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          marginBottom: 12, transition: 'all 0.15s ease',
        }}
      >
        Contester ce ban
      </button>
      <button
        onClick={() => { window.location.href = '/api/auth/signout' }}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
      >
        Se déconnecter
      </button>
    </>
  )
}

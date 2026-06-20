'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface KanbanCard {
  id: string
  title: string
  description: string | null
  column: string
  tag: string | null
  position: number
  attachment: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

const COLUMNS = [
  { id: 'todo',        label: '📋 À faire',  color: '#6b7280' },
  { id: 'in_progress', label: '⚡ En cours',  color: '#7b2bff' },
  { id: 'review',      label: '🔍 Review',    color: '#f59e0b' },
  { id: 'done',        label: '✅ Terminé',   color: '#10b981' },
]

const TAGS = [
  { id: 'feature',  label: 'Feature',   color: '#7b2bff' },
  { id: 'bug',      label: 'Bug',       color: '#ef4444' },
  { id: 'content',  label: 'Contenu',   color: '#f59e0b' },
  { id: 'design',   label: 'Design',    color: '#ec4899' },
  { id: 'backend',  label: 'Backend',   color: '#06b6d4' },
  { id: 'urgent',   label: '🔥 Urgent', color: '#ff4500' },
]

// ── Image compression ─────────────────────────────────────────────────────────
function compressImage(file: File | Blob, maxW = 1200, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Screenshot" className="max-w-[92vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()} />
      <button onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg">
        ✕
      </button>
    </div>
  )
}

// ── Card Form Modal ───────────────────────────────────────────────────────────
function CardModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<KanbanCard>
  onSave: (data: { title: string; description: string; tag: string | null; attachment: string | null }) => void
  onClose: () => void
}) {
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [desc, setDesc]             = useState(initial?.description ?? '')
  const [tag, setTag]               = useState<string | null>(initial?.tag ?? null)
  const [attachment, setAttachment] = useState<string | null>(initial?.attachment ?? null)
  const [uploading, setUploading]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | Blob) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    const compressed = await compressImage(file)
    setAttachment(compressed)
    setUploading(false)
  }

  // Paste screenshot in modal
  useEffect(() => {
    const fn = async (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (item) { e.preventDefault(); handleFile(item.getAsFile()!) }
    }
    window.addEventListener('paste', fn)
    return () => window.removeEventListener('paste', fn)
  }, []) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0820] border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-black text-lg mb-4">{initial?.id ? 'Modifier' : 'Nouvelle carte'}</h3>

        <input autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#7b2bff]/60 mb-3"
          placeholder="Titre…"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#7b2bff]/60 mb-4 resize-none"
          placeholder="Description (optionnel)…"
          rows={3}
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TAGS.map(t => (
            <button key={t.id} onClick={() => setTag(tag === t.id ? null : t.id)}
              className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
              style={{
                background: tag === t.id ? t.color : 'rgba(255,255,255,.06)',
                color: tag === t.id ? '#fff' : '#888',
                border: `1px solid ${tag === t.id ? t.color : 'transparent'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Screenshot zone */}
        <div className="mb-5">
          <p className="text-white/40 text-xs mb-2">📎 Screenshot (colle avec Ctrl+V ou upload)</p>
          {attachment ? (
            <div className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment} alt="attachment"
                className="w-full max-h-48 object-cover rounded-xl border border-white/10" />
              <button onClick={() => setAttachment(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-white/15 rounded-xl py-6 text-white/25 text-xs hover:border-white/30 hover:text-white/40 transition-colors flex flex-col items-center gap-1">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">📷</span>
                  <span>Clique ou colle (Ctrl+V)</span>
                </>
              )}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => title.trim() && onSave({ title, description: desc, tag, attachment })}
            disabled={!title.trim()}
            className="flex-1 py-2 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
            {initial?.id ? 'Sauvegarder' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function Card({
  card, onEdit, onDelete, onDragStart, onLightbox,
}: {
  card: KanbanCard
  onEdit: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onLightbox: (src: string) => void
}) {
  const tag = TAGS.find(t => t.id === card.tag)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group bg-[#0d0820] border border-white/8 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:border-white/20 transition-all select-none"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
    >
      {/* Attachment thumbnail */}
      {card.attachment && (
        <div className="relative overflow-hidden h-32 border-b border-white/5 cursor-zoom-in"
          onClick={() => onLightbox(card.attachment!)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.attachment} alt="screenshot"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="absolute bottom-1.5 right-2 text-white/50 text-[10px]">🔍 voir</span>
        </div>
      )}

      <div className="p-3.5">
        {tag && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
            style={{ background: tag.color + '25', color: tag.color, border: `1px solid ${tag.color}40` }}>
            {tag.label}
          </span>
        )}

        <p className="text-white text-sm font-semibold leading-snug mb-1">{card.title}</p>

        {card.description && (
          <p className="text-white/40 text-xs leading-relaxed mb-2 line-clamp-2">{card.description}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-white/20 text-[10px]">
            {new Date(card.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit}
              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-[#7b2bff]/40 text-white/50 hover:text-white text-xs flex items-center justify-center transition-colors">
              ✎
            </button>
            <button onClick={onDelete}
              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/40 text-white/50 hover:text-red-400 text-xs flex items-center justify-center transition-colors">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({
  col, cards, onAddCard, onEditCard, onDeleteCard,
  onDragStart, onDrop, onLightbox,
}: {
  col: typeof COLUMNS[0]
  cards: KanbanCard[]
  onAddCard: () => void
  onEditCard: (card: KanbanCard) => void
  onDeleteCard: (id: string) => void
  onDragStart: (e: React.DragEvent, card: KanbanCard) => void
  onDrop: (colId: string) => void
  onLightbox: (src: string) => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className="flex flex-col flex-1 min-w-0 rounded-2xl transition-all"
      style={{
        background: over ? `${col.color}08` : 'rgba(255,255,255,.02)',
        border: `1px solid ${over ? col.color + '50' : 'rgba(255,255,255,.06)'}`,
        boxShadow: over ? `0 0 20px ${col.color}15` : 'none',
      }}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(col.id) }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm" style={{ color: col.color }}>{col.label}</span>
          <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: col.color + '20', color: col.color }}>
            {cards.length}
          </span>
        </div>
        <button onClick={onAddCard}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold">
          +
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3 overflow-y-auto min-h-[200px]" style={{ maxHeight: 'calc(100vh - 130px)' }}>
        {cards.map(card => (
          <Card
            key={card.id}
            card={card}
            onEdit={() => onEditCard(card)}
            onDelete={() => onDeleteCard(card.id)}
            onDragStart={e => onDragStart(e, card)}
            onLightbox={onLightbox}
          />
        ))}
        {cards.length === 0 && !over && (
          <div className="flex-1 flex items-center justify-center text-white/15 text-xs text-center py-8">
            Glisse des cartes ici
          </div>
        )}
        {over && (
          <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed py-8 transition-all"
            style={{ borderColor: col.color + '40', color: col.color + '80', fontSize: 12 }}>
            Déposer ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── Live indicator ────────────────────────────────────────────────────────────
function LiveDot({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full transition-colors ${active ? 'bg-[#10b981]' : 'bg-white/20'}`}
        style={active ? { boxShadow: '0 0 6px #10b981' } : {}} />
      <span className="text-white/30 text-xs">{active ? 'En direct' : 'Hors ligne'}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const [cards, setCards]         = useState<KanbanCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [live, setLive]           = useState(true)
  const [lastSync, setLastSync]   = useState<Date | null>(null)
  const [modal, setModal]         = useState<{ col?: string; card?: KanbanCard } | null>(null)
  const [lightbox, setLightbox]   = useState<string | null>(null)
  const dragCard = useRef<KanbanCard | null>(null)
  const cardsRef = useRef<KanbanCard[]>([])
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCards = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/admin/board')
      if (!res.ok) { setLive(false); return }
      const fresh: KanbanCard[] = await res.json()
      // Only update if data actually changed (avoid re-renders on no-op polls)
      if (JSON.stringify(fresh) !== JSON.stringify(cardsRef.current)) {
        cardsRef.current = fresh
        setCards(fresh)
      }
      setLive(true)
      setLastSync(new Date())
    } catch {
      setLive(false)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Initial load + polling every 4s
  useEffect(() => {
    fetchCards()
    pollRef.current = setInterval(() => fetchCards(true), 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchCards])

  // Optimistic update helper
  function optimistic(updater: (prev: KanbanCard[]) => KanbanCard[]) {
    setCards(prev => {
      const next = updater(prev)
      cardsRef.current = next
      return next
    })
  }

  async function addCard(colId: string, data: { title: string; description: string; tag: string | null; attachment: string | null }) {
    const tmpId = `tmp_${Date.now()}`
    const tmp: KanbanCard = { id: tmpId, title: data.title, description: data.description, column: colId,
      tag: data.tag, position: cards.filter(c => c.column === colId).length,
      attachment: data.attachment, createdBy: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    optimistic(p => [...p, tmp])
    setModal(null)

    const res = await fetch('/api/admin/board', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, column: colId, position: tmp.position }),
    })
    if (res.ok) {
      const card = await res.json()
      optimistic(p => p.map(c => c.id === tmpId ? card : c))
    }
  }

  async function editCard(id: string, data: { title: string; description: string; tag: string | null; attachment: string | null }) {
    optimistic(p => p.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
    setModal(null)

    const res = await fetch('/api/admin/board', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    if (res.ok) {
      const card = await res.json()
      optimistic(p => p.map(c => c.id === id ? card : c))
    }
  }

  async function deleteCard(id: string) {
    optimistic(p => p.filter(c => c.id !== id))
    await fetch('/api/admin/board', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function moveCard(card: KanbanCard, newCol: string) {
    if (card.column === newCol) return
    optimistic(p => p.map(c => c.id === card.id ? { ...c, column: newCol, updatedAt: new Date().toISOString() } : c))
    await fetch('/api/admin/board', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, column: newCol }),
    })
  }

  const colCards = (colId: string) =>
    cards.filter(c => c.column === colId).sort((a, b) => a.position - b.position)

  return (
    <div className="min-h-svh bg-[#06010e] text-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 flex-wrap">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm">← Admin</Link>
        <div className="w-px h-4 bg-white/10" />
        <h1 className="font-black text-lg">📌 Board</h1>
        <span className="text-white/30 text-sm">{cards.length} carte{cards.length !== 1 ? 's' : ''}</span>

        <div className="ml-auto flex items-center gap-4">
          <LiveDot active={live} />
          {lastSync && (
            <span className="text-white/20 text-xs">
              Sync {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={() => fetchCards()} className="text-white/30 hover:text-white text-xs transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#7b2bff]/20 border-t-[#7b2bff] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 p-6 h-[calc(100vh-73px)] overflow-hidden">
          {COLUMNS.map(col => (
            <Column
              key={col.id}
              col={col}
              cards={colCards(col.id)}
              onAddCard={() => setModal({ col: col.id })}
              onEditCard={card => setModal({ card })}
              onDeleteCard={deleteCard}
              onDragStart={(e, card) => { dragCard.current = card; e.dataTransfer.effectAllowed = 'move' }}
              onDrop={colId => { if (dragCard.current) { moveCard(dragCard.current, colId); dragCard.current = null } }}
              onLightbox={setLightbox}
            />
          ))}
        </div>
      )}

      {/* Card modal */}
      {modal && (
        <CardModal
          initial={modal.card}
          onClose={() => setModal(null)}
          onSave={data => modal.card ? editCard(modal.card.id, data) : addCard(modal.col!, data)}
        />
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

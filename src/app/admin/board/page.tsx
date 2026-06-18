'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface KanbanCard {
  id: string
  title: string
  description: string | null
  column: string
  tag: string | null
  position: number
  createdBy: string | null
  createdAt: string
}

const COLUMNS = [
  { id: 'todo',        label: '📋 À faire',   color: '#6b7280' },
  { id: 'in_progress', label: '⚡ En cours',   color: '#7b2bff' },
  { id: 'review',      label: '🔍 Review',     color: '#f59e0b' },
  { id: 'done',        label: '✅ Terminé',    color: '#10b981' },
]

const TAGS = [
  { id: 'feature',  label: 'Feature',  color: '#7b2bff' },
  { id: 'bug',      label: 'Bug',      color: '#ef4444' },
  { id: 'content',  label: 'Contenu',  color: '#f59e0b' },
  { id: 'design',   label: 'Design',   color: '#ec4899' },
  { id: 'backend',  label: 'Backend',  color: '#06b6d4' },
  { id: 'urgent',   label: '🔥 Urgent', color: '#ff4500' },
]

// ── Card Form Modal ───────────────────────────────────────────────────────────
function CardModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<KanbanCard>
  onSave: (data: { title: string; description: string; tag: string | null }) => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(initial?.title ?? '')
  const [desc, setDesc]         = useState(initial?.description ?? '')
  const [tag, setTag]           = useState<string | null>(initial?.tag ?? null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0820] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-black text-lg mb-4">{initial?.id ? 'Modifier' : 'Nouvelle carte'}</h3>

        <input
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#7b2bff]/60 mb-3"
          placeholder="Titre…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && title.trim() && onSave({ title, description: desc, tag })}
        />

        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#7b2bff]/60 mb-4 resize-none"
          placeholder="Description (optionnel)…"
          rows={3}
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5 mb-5">
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

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => title.trim() && onSave({ title, description: desc, tag })}
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
  card, onEdit, onDelete, onDragStart,
}: {
  card: KanbanCard
  onEdit: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const tag = TAGS.find(t => t.id === card.tag)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group bg-[#0d0820] border border-white/8 rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:border-white/20 transition-all select-none"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
    >
      {tag && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
          style={{ background: tag.color + '30', color: tag.color, border: `1px solid ${tag.color}50` }}>
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
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({
  col, cards, onAddCard, onEditCard, onDeleteCard,
  onDragStart, onDrop, onDragOver,
}: {
  col: typeof COLUMNS[0]
  cards: KanbanCard[]
  onAddCard: () => void
  onEditCard: (card: KanbanCard) => void
  onDeleteCard: (id: string) => void
  onDragStart: (e: React.DragEvent, card: KanbanCard) => void
  onDrop: (e: React.DragEvent, colId: string) => void
  onDragOver: (e: React.DragEvent) => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className="flex flex-col w-72 flex-shrink-0 rounded-2xl transition-all"
      style={{
        background: over ? `${col.color}08` : 'rgba(255,255,255,.02)',
        border: `1px solid ${over ? col.color + '40' : 'rgba(255,255,255,.06)'}`,
      }}
      onDragOver={e => { e.preventDefault(); setOver(true); onDragOver(e) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { setOver(false); onDrop(e, col.id) }}
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
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm">
          +
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3 flex-1 min-h-[200px]">
        {cards.map(card => (
          <Card
            key={card.id}
            card={card}
            onEdit={() => onEditCard(card)}
            onDelete={() => onDeleteCard(card.id)}
            onDragStart={e => onDragStart(e, card)}
          />
        ))}
        {cards.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/15 text-xs text-center py-8">
            Glisse des cartes ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const [cards, setCards]     = useState<KanbanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ col?: string; card?: KanbanCard } | null>(null)
  const dragCard = useRef<KanbanCard | null>(null)

  async function load() {
    const res = await fetch('/api/admin/board')
    if (res.ok) setCards(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addCard(colId: string, data: { title: string; description: string; tag: string | null }) {
    const colCards = cards.filter(c => c.column === colId)
    const res = await fetch('/api/admin/board', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, column: colId, position: colCards.length }),
    })
    if (res.ok) { const card = await res.json(); setCards(p => [...p, card]) }
    setModal(null)
  }

  async function editCard(id: string, data: { title: string; description: string; tag: string | null }) {
    const res = await fetch('/api/admin/board', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    if (res.ok) { const card = await res.json(); setCards(p => p.map(c => c.id === id ? card : c)) }
    setModal(null)
  }

  async function deleteCard(id: string) {
    await fetch('/api/admin/board', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCards(p => p.filter(c => c.id !== id))
  }

  async function moveCard(card: KanbanCard, newCol: string) {
    if (card.column === newCol) return
    const res = await fetch('/api/admin/board', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, column: newCol }),
    })
    if (res.ok) { const updated = await res.json(); setCards(p => p.map(c => c.id === card.id ? updated : c)) }
  }

  const colCards = (colId: string) =>
    cards.filter(c => c.column === colId).sort((a, b) => a.position - b.position)

  return (
    <div className="min-h-svh bg-[#06010e] text-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm">← Admin</Link>
        <div className="w-px h-4 bg-white/10" />
        <h1 className="font-black text-lg">📌 Board</h1>
        <span className="text-white/30 text-sm">{cards.length} carte{cards.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#7b2bff]/20 border-t-[#7b2bff] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 p-6 overflow-x-auto pb-10">
          {COLUMNS.map(col => (
            <Column
              key={col.id}
              col={col}
              cards={colCards(col.id)}
              onAddCard={() => setModal({ col: col.id })}
              onEditCard={card => setModal({ card })}
              onDeleteCard={deleteCard}
              onDragStart={(e, card) => { dragCard.current = card; e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { e.preventDefault() }}
              onDrop={(_, colId) => { if (dragCard.current) { moveCard(dragCard.current, colId); dragCard.current = null } }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CardModal
          initial={modal.card}
          onClose={() => setModal(null)}
          onSave={data => modal.card ? editCard(modal.card.id, data) : addCard(modal.col!, data)}
        />
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeftRight, Plus, X, Check, Clock, ChevronDown, Search } from 'lucide-react'
import { useGameStore } from '@/store/game'
import { FeatureGate } from '@/components/FeatureGate'
import { cn } from '@/lib/utils'

const RARITY_COLOR: Record<string, string> = {
  void: '#a855f7', legendary: '#ff9a3d', epic: '#ec4899', rare: '#4aa3ff', common: '#9ca3af',
}
const RARITY_LABEL: Record<string, string> = {
  void: 'VOID', legendary: 'Légendaire', epic: 'Épique', rare: 'Rare', common: 'Commun',
}

interface Trade {
  id: string
  senderId: string
  receiverId: string
  senderUsername: string
  senderAvatarUrl: string | null
  receiverUsername: string
  receiverAvatarUrl: string | null
  offeredCardKey: string
  offeredRarity: string
  wantedCardKey: string
  wantedCardName: string | null
  wantedRarity: string | null
  message: string | null
  status: string
  createdAt: string
  expiresAt: string | null
}

interface MyCard {
  cardId: string
  rarity: string
  family: string
  count: number
  name: string
  image_url: string | null
}

interface Friend {
  friend_id: string
  username: string | null
  avatar_url: string | null
}

interface AllCard {
  id: string
  name: string
  rarity: string
  image_url: string | null
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function RarityBadge({ rarity }: { rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
      style={{ color, background: color + '20' }}>
      {RARITY_LABEL[rarity] ?? rarity}
    </span>
  )
}

function CardThumb({ name, imageUrl, rarity }: { name: string; imageUrl?: string | null; rarity: string }) {
  const color = RARITY_COLOR[rarity] ?? '#9ca3af'
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-10 rounded flex-shrink-0 overflow-hidden border"
        style={{ borderColor: color + '60', background: '#0a0816' }}>
        {imageUrl
          ? <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[8px] text-white/20">?</div>
        }
      </div>
      <div>
        <p className="text-white text-xs font-bold truncate max-w-[120px] uppercase">{name}</p>
        <RarityBadge rarity={rarity} />
      </div>
    </div>
  )
}

// ── Modal création de trade ───────────────────────────────────────────────────
function CreateTradeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<'offer' | 'want' | 'friend' | 'confirm'>('offer')
  const [myCards, setMyCards]     = useState<MyCard[]>([])
  const [allCards, setAllCards]   = useState<AllCard[]>([])
  const [friends, setFriends]     = useState<Friend[]>([])
  const [cardDefs, setCardDefs]   = useState<Record<string, AllCard>>({})
  const [search, setSearch]       = useState('')
  const [offered, setOffered]     = useState<MyCard | null>(null)
  const [wanted, setWanted]       = useState<AllCard | null>(null)
  const [receiver, setReceiver]   = useState<Friend | null>(null)
  const [message, setMessage]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/collection').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
      fetch('/api/social/friends').then(r => r.ok ? r.json() : []),
    ]).then(([col, cards, fr]) => {
      const defs: Record<string, AllCard> = {}
      for (const c of cards ?? []) {
        const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
        defs[c.id] = { id: c.id, name: c.name, rarity: c.rarity ?? 'common', image_url: c.imageUrl ?? c.image_url ?? meta?.image_url ?? null }
      }
      setCardDefs(defs)
      setAllCards(Object.values(defs))
      setMyCards((col ?? []).map((c: { cardId?: string; card_id?: string; rarity: string; family: string; count: number }) => {
        const key = c.cardId ?? c.card_id ?? ''
        const def = defs[key]
        return { cardId: key, rarity: c.rarity, family: c.family, count: c.count, name: def?.name ?? key, image_url: def?.image_url ?? null }
      }).filter((c: MyCard) => c.count >= 1))
      setFriends((fr ?? []).map((f: Record<string, unknown>) => ({
        friend_id: f.userId ?? f.friend_id,
        username: f.username ?? null,
        avatar_url: f.avatarUrl ?? f.avatar_url ?? null,
      })))
    })
  }, [])

  async function submit() {
    if (!offered || !wanted || !receiver) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: receiver.friend_id,
          offeredCardKey: offered.cardId, offeredRarity: offered.rarity,
          wantedCardKey: wanted.id, wantedCardName: wanted.name, wantedRarity: wanted.rarity,
          message: message || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      onCreated()
    } catch { setError('Erreur réseau') }
    finally { setSaving(false) }
  }

  const filteredCards = (step === 'offer' ? myCards.map(c => ({ id: c.cardId, name: c.name, rarity: c.rarity, image_url: c.image_url, count: c.count }))
    : allCards.map(c => ({ ...c, count: undefined }))).filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:w-[500px] max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0a0612] border border-white/10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <h3 className="text-white font-black flex items-center gap-2"><ArrowLeftRight size={16} /> Proposer un trade</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 px-5 py-3 flex-shrink-0">
          {(['offer', 'want', 'friend', 'confirm'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn('w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all',
                step === s ? 'bg-[#7b2bff] text-white' : ((['offer', 'want', 'friend', 'confirm'].indexOf(step) > i) ? 'bg-[#7b2bff]/40 text-white/60' : 'bg-white/5 text-white/30'))}>
                {i + 1}
              </div>
              {i < 3 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-white/40">
            {step === 'offer' ? 'Carte à offrir' : step === 'want' ? 'Carte voulue' : step === 'friend' ? 'Destinataire' : 'Confirmer'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(step === 'offer' || step === 'want') && (
            <div className="px-4 pb-4">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une carte…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none text-white" />
              </div>
              <div className="space-y-1.5">
                {filteredCards.slice(0, 50).map(c => {
                  const selected = step === 'offer' ? offered?.cardId === c.id : wanted?.id === c.id
                  return (
                    <button key={c.id} onClick={() => {
                      if (step === 'offer') { setOffered({ cardId: c.id, rarity: c.rarity, family: '', count: (c as { count?: number }).count ?? 1, name: c.name, image_url: c.image_url ?? null }); setStep('want'); setSearch('') }
                      else { setWanted({ id: c.id, name: c.name, rarity: c.rarity, image_url: c.image_url ?? null }); setStep('friend') }
                    }}
                      className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left',
                        selected ? 'border-[#7b2bff] bg-[#7b2bff]/10' : 'border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]')}>
                      <CardThumb name={c.name} imageUrl={c.image_url} rarity={c.rarity} />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(c as { count?: number }).count !== undefined && (
                          <span className="text-xs text-white/30">x{(c as { count?: number }).count}</span>
                        )}
                        {selected && <Check size={14} className="text-[#7b2bff]" />}
                      </div>
                    </button>
                  )
                })}
                {filteredCards.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucune carte trouvée</p>}
              </div>
            </div>
          )}

          {step === 'friend' && (
            <div className="px-4 pb-4 space-y-2">
              {friends.length === 0 && <p className="text-center text-white/30 text-sm py-8">Aucun ami — ajoute des amis d&apos;abord</p>}
              {friends.map(f => (
                <button key={f.friend_id} onClick={() => { setReceiver(f); setStep('confirm') }}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                    receiver?.friend_id === f.friend_id ? 'border-[#7b2bff] bg-[#7b2bff]/10' : 'border-white/[0.06] hover:border-white/20')}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {f.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-white font-bold text-sm">{f.username}</span>
                  {receiver?.friend_id === f.friend_id && <Check size={14} className="text-[#7b2bff] ml-auto" />}
                </button>
              ))}
            </div>
          )}

          {step === 'confirm' && offered && wanted && receiver && (
            <div className="px-4 pb-4 space-y-4">
              <div className="rounded-2xl border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs mb-1.5">Tu offres</p>
                    <CardThumb name={offered.name} imageUrl={offered.image_url} rarity={offered.rarity} />
                  </div>
                  <ArrowLeftRight size={18} className="text-white/20 flex-shrink-0" />
                  <div className="text-right">
                    <p className="text-white/40 text-xs mb-1.5">Tu veux</p>
                    <CardThumb name={wanted.name} imageUrl={wanted.image_url} rarity={wanted.rarity} />
                  </div>
                </div>
                <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-xs font-bold text-white">
                    {receiver.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-white/60 text-sm">Proposé à <span className="text-white font-bold">{receiver.username}</span></span>
                </div>
              </div>

              <div>
                <label className="text-white/40 text-xs block mb-1.5">Message (optionnel)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Un petit mot…" rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm focus:border-[#7b2bff]/60 focus:outline-none text-white resize-none" />
              </div>

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
          {step !== 'offer' && (
            <button onClick={() => {
              if (step === 'want') setStep('offer')
              else if (step === 'friend') setStep('want')
              else setStep('friend')
            }} className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm font-bold hover:bg-white/5">
              Retour
            </button>
          )}
          {step === 'confirm' && (
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
              {saving ? 'Envoi…' : 'Envoyer la proposition'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
function TradeContent() {
  const { user } = useGameStore(s => ({ user: s.user }))
  const [trades, setTrades]     = useState<Trade[]>([])
  const [tab, setTab]           = useState<'incoming' | 'outgoing'>('incoming')
  const [showCreate, setShowCreate] = useState(false)
  const [cardDefs, setCardDefs]  = useState<Record<string, { name: string; image_url: string | null }>>({})
  const [actioning, setActioning] = useState<string | null>(null)
  const [msg, setMsg]           = useState('')

  const load = useCallback(async () => {
    const [pending, cards] = await Promise.all([
      fetch('/api/trade?status=pending').then(r => r.ok ? r.json() : []),
      fetch('/api/cards').then(r => r.ok ? r.json() : []),
    ])
    setTrades(pending ?? [])
    const defs: Record<string, { name: string; image_url: string | null }> = {}
    for (const c of cards ?? []) {
      const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata || '{}') } catch { return {} } })() : (c.metadata ?? {})
      defs[c.id] = { name: c.name, image_url: c.imageUrl ?? c.image_url ?? meta?.image_url ?? null }
    }
    setCardDefs(defs)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function action(tradeId: string, act: 'accept' | 'decline' | 'cancel') {
    setActioning(tradeId)
    try {
      const res = await fetch(`/api/trade/${tradeId}/${act}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? 'Erreur'); setTimeout(() => setMsg(''), 4000); return }
      setMsg(act === 'accept' ? '✅ Trade accepté !' : act === 'decline' ? 'Trade refusé.' : 'Trade annulé.')
      setTimeout(() => setMsg(''), 3000)
      load()
    } finally { setActioning(null) }
  }

  const incoming = trades.filter(t => t.receiverId === user?.id)
  const outgoing  = trades.filter(t => t.senderId   === user?.id)
  const displayed = tab === 'incoming' ? incoming : outgoing

  if (!user) return <div className="flex items-center justify-center h-40 text-white/40 text-sm">Connecte-toi pour accéder aux trades.</div>

  return (
    <div className="pb-20 max-w-lg mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-black text-lg flex items-center gap-2"><ArrowLeftRight size={18} /> Trades</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
          <Plus size={14} /> Proposer
        </button>
      </div>

      {msg && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-sm text-white text-center">{msg}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] mb-4">
        {(['incoming', 'outgoing'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative',
              tab === t ? 'bg-[#7b2bff] text-white' : 'text-white/40 hover:text-white/60')}>
            {t === 'incoming' ? 'Reçus' : 'Envoyés'}
            {t === 'incoming' && incoming.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4757] text-white text-[9px] font-bold flex items-center justify-center">
                {incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Trade list */}
      {displayed.length === 0 ? (
        <div className="text-center text-white/30 text-sm py-12">
          {tab === 'incoming' ? 'Aucun trade reçu en attente.' : 'Aucun trade envoyé en attente.'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(trade => {
            const offeredDef = cardDefs[trade.offeredCardKey]
            const wantedDef  = cardDefs[trade.wantedCardKey]
            const isSender    = trade.senderId === user.id
            const otherName   = isSender ? trade.receiverUsername : trade.senderUsername
            const otherAvatar = isSender ? trade.receiverAvatarUrl : trade.senderAvatarUrl
            return (
              <div key={trade.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4">
                {/* Counterpart */}
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
                  {otherAvatar
                    ? <img src={otherAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7b2bff] to-[#4a1fa8] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{otherName[0]?.toUpperCase()}</div>
                  }
                  <span className="text-white/50 text-xs">
                    {isSender ? 'Proposé à' : 'Reçu de'}{' '}
                    <span className="text-white font-bold">{otherName}</span>
                  </span>
                </div>
                {/* Cards */}
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-white/30 text-[10px] mb-1.5">{isSender ? 'Tu offres' : `${otherName} offre`}</p>
                    <CardThumb name={offeredDef?.name ?? trade.offeredCardKey} imageUrl={offeredDef?.image_url} rarity={trade.offeredRarity} />
                  </div>
                  <ArrowLeftRight size={16} className="text-white/20 flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="text-white/30 text-[10px] mb-1.5">{isSender ? 'Tu veux' : `${otherName} veut`}</p>
                    <div className="flex flex-col items-end">
                      <CardThumb name={wantedDef?.name ?? trade.wantedCardName ?? trade.wantedCardKey} imageUrl={wantedDef?.image_url} rarity={trade.wantedRarity ?? 'common'} />
                    </div>
                  </div>
                </div>

                {/* Message */}
                {trade.message && (
                  <p className="text-white/40 text-xs italic border-t border-white/[0.06] pt-2 mb-2">&ldquo;{trade.message}&rdquo;</p>
                )}

                {/* Meta + actions */}
                <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                  <div className="flex items-center gap-1 text-white/30 text-[10px]">
                    <Clock size={11} />
                    {trade.expiresAt ? `Expire le ${formatDate(trade.expiresAt)}` : formatDate(trade.createdAt)}
                  </div>
                  <div className="flex gap-2">
                    {!isSender && (
                      <>
                        <button onClick={() => action(trade.id, 'decline')} disabled={!!actioning}
                          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                          Refuser
                        </button>
                        <button onClick={() => action(trade.id, 'accept')} disabled={!!actioning}
                          className="px-3 py-1.5 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#7b2bff,#4a1fa8)' }}>
                          {actioning === trade.id ? '…' : 'Accepter'}
                        </button>
                      </>
                    )}
                    {isSender && (
                      <button onClick={() => action(trade.id, 'cancel')} disabled={!!actioning}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-white/60 text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                        {actioning === trade.id ? '…' : 'Annuler'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateTradeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
      )}
    </div>
  )
}

export default function TradePage() {
  return (
    <FeatureGate featureKey="feature_trading" label="Les échanges de cartes">
      <TradeContent />
    </FeatureGate>
  )
}

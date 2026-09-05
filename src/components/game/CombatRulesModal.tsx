'use client'
import { X, Gem, Sword, Shield, Swords, Zap, Settings, Target, Sparkles } from 'lucide-react'

interface Props { onClose: () => void }

const EFFECTS = [
  { name: 'Void Surge', color: '#a855f7', desc: "Toutes les cartes Void ont cet effet. En posant la carte, les cartes adverses prennent 1 dégât ou perdent leur bouclier." },
  { name: 'Vol de vie', color: '#ef4444', desc: "Redonne de la vie au joueur à chaque fois qu'il élimine une carte adverse." },
  { name: 'Bouclier',   color: '#60a5fa', desc: "Absorbe une attaque peu importe sa puissance. Détruit après le premier coup." },
  { name: 'Furtivité',  color: '#6b7280', desc: "Ne peut pas être ciblée tant qu'elle n'a pas attaqué." },
  { name: 'Charge',     color: '#22c55e', desc: "Peut attaquer dès qu'elle est posée sur le terrain." },
  { name: 'Provocation',color: '#f59e0b', desc: "Force l'adversaire à cibler cette carte en priorité." },
]

export function CombatRulesModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full rounded-2xl flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #1a1030 0%, #0d0a1a 100%)',
          border: '1px solid rgba(168,85,247,0.3)',
          maxWidth: 700,
          maxHeight: 'calc(100vh - 32px)',
          boxShadow: '0 0 40px rgba(168,85,247,0.2)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <Swords size={16} className="text-purple-400" />
            <h2 className="text-base font-bold text-white">Règles du combat</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/20 hover:text-white/60 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Contenu en 2 colonnes */}
        <div className="grid grid-cols-2 min-h-0 flex-1" style={{ overflow: 'hidden' }}>

          {/* Colonne gauche */}
          <div className="px-4 py-4 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Stats cartes */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-purple-400" />
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Statistiques</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  { icon: <Gem size={16} />, label: 'Mana', sub: "Invocation", color: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.4)', iconColor: '#a855f7' },
                  { icon: <Sword size={16} />, label: 'Attaque', sub: 'Dégâts', color: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', iconColor: '#ef4444' },
                  { icon: <Shield size={16} />, label: 'Défense', sub: 'PV', color: 'rgba(96,165,250,0.2)', border: 'rgba(96,165,250,0.4)', iconColor: '#60a5fa' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl py-2.5 px-1 flex flex-col items-center gap-1" style={{ background: s.color, border: `1px solid ${s.border}` }}>
                    <span style={{ color: s.iconColor }}>{s.icon}</span>
                    <div className="text-[10px] font-bold text-white">{s.label}</div>
                    <div className="text-[9px] text-white/40">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonctionnement */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Settings size={11} className="text-purple-400" />
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Fonctionnement</p>
              </div>
              <div className="space-y-1">
                {[
                  { label: 'Début', value: '4 cartes · 1 mana' },
                  { label: 'Chaque tour', value: '+1 carte · +1 mana' },
                  { label: 'Terrain max', value: '5 cartes' },
                  { label: 'Attaque', value: 'Tour suivant (sauf Charge)' },
                  { label: 'Victoire', value: '30 PV adverses à 0' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-[11px] text-white/40">{r.label}</span>
                    <span className="text-[11px] font-semibold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attaquer */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={11} className="text-purple-400" />
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Attaquer</p>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Sélectionnez votre carte puis cliquez sur une carte adverse ou sur le portrait du joueur ennemi. Quand deux cartes s&apos;affrontent, chacune perd des points de défense égaux à l&apos;attaque de l&apos;autre. Sauf si une carte <span className="text-amber-400 font-semibold">Provocation</span> est posée, vous choisissez toujours votre cible librement.
              </p>
            </div>

            {/* Conseil deck */}
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <p className="text-[10px] font-semibold text-purple-300 mb-1">Conseil</p>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Équilibrez votre deck lors de la construction. Un deck avec trop de cartes coûteuses vous empêchera de jouer pendant plusieurs tours; le mana manquera au début.
              </p>
            </div>
          </div>

          {/* Colonne droite — Effets */}
          <div className="px-4 py-4 overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={11} className="text-purple-400" />
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Effets des cartes</p>
            </div>
            <div className="space-y-2">
              {EFFECTS.map(e => (
                <div key={e.name} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mb-1" style={{ background: `${e.color}20`, border: `1px solid ${e.color}50`, color: e.color }}>
                    {e.name}
                  </span>
                  <p className="text-[11px] text-white/50 leading-relaxed">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'

const TABS = [
  { href: '/communaute/amis',   label: '👥 Amis'    },
  { href: '/communaute/trades', label: '⇌ Trades'  },
  { href: '/communaute/combat', label: '⚔ Combat'  },
  { href: '/communaute/ladder', label: '🏆 Ladder'  },
]

export default function CommunautePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Communauté</h2>
      <div className="grid grid-cols-2 gap-3">
        {TABS.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center justify-center py-6 rounded-2xl bg-[rgba(10,8,22,0.7)] border border-white/8 text-sm font-semibold hover:border-void-purple/40 hover:bg-[rgba(123,43,255,0.1)] transition-all"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

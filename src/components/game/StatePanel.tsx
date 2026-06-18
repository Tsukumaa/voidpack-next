import type { LucideIcon } from 'lucide-react'

/**
 * Panneau réutilisable pour les états vides / non connecté.
 * Même style que l'écran pack : verre dépoli + badge d'icône en dégradé.
 */
export function StatePanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] w-full px-4">
      <div
        className="flex flex-col items-center gap-3.5 px-7 py-7 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl w-[88vw] max-w-[360px]"
        style={{ boxShadow: '0 0 45px rgba(123,43,255,0.18)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg,#7b2bff,#a855f7)',
            boxShadow: '0 0 22px rgba(123,43,255,0.55)',
          }}
        >
          <Icon size={24} className="text-white" />
        </div>

        <div className="text-center">
          <p className="text-white font-bold text-base">{title}</p>
          <p className="text-white/45 text-sm mt-1.5 leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  )
}

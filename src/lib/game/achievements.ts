// Définition de tous les succès
export const ACHIEVEMENTS = [
  // ── Boosters ──────────────────────────────────────────────────────────────
  { id: 'open_first',    label: 'Premier pack',      desc: 'Ouvrir ton premier booster',     icon: '🎴', xp: 30  },
  { id: 'open_10',       label: '10 boosters',       desc: 'Ouvrir 10 boosters',             icon: '📦', xp: 80  },
  { id: 'open_50',       label: '50 boosters',       desc: 'Ouvrir 50 boosters',             icon: '🔮', xp: 200 },
  { id: 'open_100',      label: '100 boosters',      desc: 'Ouvrir 100 boosters',            icon: '👁️', xp: 400 },
  { id: 'open_500',      label: '500 boosters',      desc: 'Ouvrir 500 boosters',            icon: '🌌', xp: 1000 },

  // ── Raretés ───────────────────────────────────────────────────────────────
  { id: 'get_rare',      label: 'Rare',              desc: 'Obtenir une carte rare',         icon: '💎', xp: 50  },
  { id: 'get_epic',      label: 'Épique',            desc: 'Obtenir une carte épique',       icon: '⚡', xp: 100 },
  { id: 'get_legendary', label: 'Légendaire',        desc: 'Obtenir une carte légendaire',   icon: '👑', xp: 250 },
  { id: 'get_void',      label: 'VOID',              desc: 'Obtenir une carte VOID',         icon: '🌀', xp: 500 },

  // ── Collection ────────────────────────────────────────────────────────────
  { id: 'cards_10',      label: '10 cartes',         desc: '10 cartes uniques',              icon: '📚', xp: 80  },
  { id: 'cards_25',      label: '25 cartes',         desc: '25 cartes uniques',              icon: '🗺️', xp: 150 },
  { id: 'cards_50',      label: '50 cartes',         desc: '50 cartes uniques',              icon: '🗃️', xp: 300 },
  { id: 'cards_100',     label: '100 cartes',        desc: '100 cartes uniques',             icon: '🏛️', xp: 600 },

  // ── Streak ────────────────────────────────────────────────────────────────
  { id: 'streak_3',      label: '3 jours',           desc: '3 jours consécutifs',            icon: '🔥', xp: 50  },
  { id: 'streak_7',      label: '7 jours',           desc: '7 jours consécutifs',            icon: '💪', xp: 120 },
  { id: 'streak_30',     label: '30 jours',          desc: '30 jours consécutifs',           icon: '🏆', xp: 400 },
  { id: 'streak_100',    label: '100 jours',         desc: '100 jours consécutifs',          icon: '🌟', xp: 1000 },

  // ── Niveaux ───────────────────────────────────────────────────────────────
  { id: 'level_5',       label: 'Niveau 5',          desc: 'Atteindre le niveau 5',         icon: '⭐', xp: 80  },
  { id: 'level_10',      label: 'Niveau 10',         desc: 'Atteindre le niveau 10',        icon: '🌟', xp: 150 },
  { id: 'level_25',      label: 'Niveau 25',         desc: 'Atteindre le niveau 25',        icon: '💫', xp: 400 },
  { id: 'level_50',      label: 'Niveau 50',         desc: 'Atteindre le niveau 50',        icon: '✨', xp: 800 },

  // ── Social ────────────────────────────────────────────────────────────────
  { id: 'friend_1',      label: 'Premier ami',       desc: 'Ajouter 1 ami',                 icon: '🤝', xp: 60  },
  { id: 'friend_5',      label: '5 amis',            desc: 'Avoir 5 amis',                  icon: '👥', xp: 150 },

  // ── Combat ────────────────────────────────────────────────────────────────
  { id: 'win_1',         label: 'Première victoire', desc: 'Gagner 1 combat',               icon: '⚔️', xp: 80  },
  { id: 'win_10',        label: '10 victoires',      desc: 'Gagner 10 combats',             icon: '🗡️', xp: 250 },
  { id: 'win_50',        label: '50 victoires',      desc: 'Gagner 50 combats',             icon: '🏅', xp: 600 },

  // ── Trading ───────────────────────────────────────────────────────────────
  { id: 'trade_1',       label: 'Premier échange',   desc: 'Réaliser 1 échange',            icon: '🔄', xp: 80  },
  { id: 'trade_10',      label: '10 échanges',       desc: 'Réaliser 10 échanges',          icon: '💱', xp: 300 },
]

// ── Missions quotidiennes (pool — 3 sélectionnées chaque jour) ─────────────
export const DAILY_MISSIONS = [
  { id: 'open_1_pack',    label: 'Pack du jour',     desc: 'Ouvrir 1 booster',               icon: '🎴', goal: 1,  xp: 40  },
  { id: 'open_3_packs',   label: 'Triple pack',      desc: 'Ouvrir 3 boosters',              icon: '📦', goal: 3,  xp: 100 },
  { id: 'open_5_packs',   label: 'Frénésie',         desc: 'Ouvrir 5 boosters',              icon: '🔮', goal: 5,  xp: 180 },
  { id: 'get_rare',       label: 'Rare du jour',     desc: 'Obtenir 1 carte rare ou mieux',  icon: '💎', goal: 1,  xp: 70  },
  { id: 'get_epic',       label: 'Chasse épique',    desc: 'Obtenir 1 carte épique ou mieux',icon: '⚡', goal: 1,  xp: 150 },
  { id: 'daily_login',    label: 'Présent',          desc: "Se connecter aujourd'hui",       icon: '📅', goal: 1,  xp: 20  },
  { id: 'collect_5',      label: 'Collecte',         desc: 'Obtenir 5 cartes',               icon: '📚', goal: 5,  xp: 60  },
  { id: 'open_void_pack', label: 'VOID Pack',        desc: 'Ouvrir un VOID Pack',            icon: '🌀', goal: 1,  xp: 90  },
  { id: 'win_combat',     label: 'Victoire',         desc: 'Gagner 1 combat',                icon: '⚔️', goal: 1,  xp: 130 },
  { id: 'make_trade',     label: 'Échange',          desc: 'Réaliser 1 échange',             icon: '🔄', goal: 1,  xp: 100 },
]

// Sélectionner 3 missions pour aujourd'hui (déterministe selon la date)
export function getTodayMissions() {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const hash = (id: string) => id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const shuffled = [...DAILY_MISSIONS].sort((a, b) => {
    const ha = Math.sin(seed * 31 + hash(a.id)) * 10000
    const hb = Math.sin(seed * 31 + hash(b.id)) * 10000
    return (ha - Math.floor(ha)) - (hb - Math.floor(hb))
  })
  return shuffled.slice(0, 3)
}

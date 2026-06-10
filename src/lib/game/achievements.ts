// Définition de tous les succès
export const ACHIEVEMENTS = [
  // Ouverture boosters
  { id: 'open_first',     label: 'Premier pas',        desc: 'Ouvrir ton premier booster',          icon: '🎴', xp: 50  },
  { id: 'open_10',        label: 'Collectionneur',      desc: 'Ouvrir 10 boosters',                  icon: '📦', xp: 100 },
  { id: 'open_50',        label: 'Accro',               desc: 'Ouvrir 50 boosters',                  icon: '🔮', xp: 300 },
  { id: 'open_100',       label: 'Obsessionnel',        desc: 'Ouvrir 100 boosters',                 icon: '👁️', xp: 500 },
  // Raretés
  { id: 'get_rare',       label: 'Chance du débutant',  desc: 'Obtenir une carte rare',              icon: '💎', xp: 80  },
  { id: 'get_epic',       label: 'Épique',              desc: 'Obtenir une carte épique',            icon: '⚡', xp: 150 },
  { id: 'get_legendary',  label: 'Légendaire',          desc: 'Obtenir une carte légendaire',        icon: '👑', xp: 300 },
  { id: 'get_void',       label: 'VOID',                desc: 'Obtenir une carte VOID',              icon: '🌀', xp: 500 },
  // Collection
  { id: 'cards_10',       label: 'Débutant',            desc: '10 cartes uniques',                   icon: '📚', xp: 100 },
  { id: 'cards_25',       label: 'Explorateur',         desc: '25 cartes uniques',                   icon: '🗺️', xp: 200 },
  { id: 'cards_50',       label: 'Archiviste',          desc: '50 cartes uniques',                   icon: '🗃️', xp: 400 },
  { id: 'cards_100',      label: 'Maître',              desc: '100 cartes uniques',                  icon: '🏛️', xp: 800 },
  // Streak
  { id: 'streak_3',       label: 'Régulier',            desc: '3 jours consécutifs',                 icon: '🔥', xp: 60  },
  { id: 'streak_7',       label: 'Assidu',              desc: '7 jours consécutifs',                 icon: '💪', xp: 150 },
  { id: 'streak_30',      label: 'Dévoué',              desc: '30 jours consécutifs',                icon: '🏆', xp: 500 },
  // Niveaux
  { id: 'level_5',        label: 'En progression',      desc: 'Atteindre le niveau 5',              icon: '⭐', xp: 100 },
  { id: 'level_10',       label: 'Expérimenté',         desc: 'Atteindre le niveau 10',             icon: '🌟', xp: 200 },
  { id: 'level_25',       label: 'Vétéran',             desc: 'Atteindre le niveau 25',             icon: '💫', xp: 500 },
  { id: 'level_50',       label: 'Légende',             desc: 'Atteindre le niveau 50',             icon: '✨', xp: 1000 },
]

// Définition des missions quotidiennes (pool — 3 sont sélectionnées aléatoirement chaque jour)
export const DAILY_MISSIONS = [
  { id: 'open_1_pack',    label: 'Ouverture',           desc: 'Ouvrir 1 booster',                   icon: '🎴', goal: 1,  xp: 50  },
  { id: 'open_3_packs',   label: 'Frénésie',            desc: 'Ouvrir 3 boosters',                  icon: '📦', goal: 3,  xp: 150 },
  { id: 'get_rare',       label: 'Chasse aux raretés',  desc: 'Obtenir 1 carte rare ou mieux',      icon: '💎', goal: 1,  xp: 100 },
  { id: 'get_epic',       label: 'Chasseur épique',     desc: 'Obtenir 1 carte épique ou mieux',    icon: '⚡', goal: 1,  xp: 200 },
  { id: 'daily_login',    label: 'Connexion',           desc: 'Se connecter aujourd\'hui',          icon: '📅', goal: 1,  xp: 30  },
  { id: 'collect_5',      label: 'Collecte',            desc: 'Ajouter 5 cartes à ta collection',   icon: '📚', goal: 5,  xp: 80  },
  { id: 'open_void_pack', label: 'Dans le VOID',        desc: 'Ouvrir un VOID Pack',                icon: '🌀', goal: 1,  xp: 120 },
]

// Sélectionner 3 missions pour aujourd'hui (déterministe selon la date)
export function getTodayMissions() {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const shuffled = [...DAILY_MISSIONS].sort((a, b) => {
    const ha = Math.sin(seed + a.id.charCodeAt(0)) * 10000
    const hb = Math.sin(seed + b.id.charCodeAt(0)) * 10000
    return (ha - Math.floor(ha)) - (hb - Math.floor(hb))
  })
  return shuffled.slice(0, 3)
}

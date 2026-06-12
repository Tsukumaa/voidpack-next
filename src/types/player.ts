export interface PlayerProfile {
  user_id: string
  username: string | null
  avatar_url: string | null
  level: number
  xp: number
  packs_opened: number
  highest_rarity: string | null
  void_pulls: number
  is_admin: boolean
  created_at: string
  twitch_login: string | null
}

export interface BoosterCredit {
  id: number
  booster_type: string
  source: string
  created_at: string
}

export interface ProgressionSummary {
  level: number
  xp: number
  currentLevelXp: number
  nextLevelXp: number
  percent: number
  packsOpened: number
  voidPulls: number
  highestRarity: string | null
}

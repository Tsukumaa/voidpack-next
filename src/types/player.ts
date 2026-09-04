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
  role?: 'founder' | 'developer' | 'artist' | 'streamer' | null
  is_subscriber?: boolean
  subscriber_until?: string | null
  kofi_email?: string | null
  created_at: string
  twitch_login: string | null
  selected_card_back: string | null
  unlocked_card_backs: string[] | null
  owned_arenas?: string[]
  auto_reveal?: boolean
  favorite_cards?: string[] | null
  collection_complete?: boolean
  streamer_channel?: { login: string; active: boolean } | null
}

export interface BoosterCredit {
  id: number
  booster_type: string
  source: string
  created_at: string
  opened_cards?: { id: string; name: string; rarity: string; family: string; artUrl?: string | null }[] | null
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

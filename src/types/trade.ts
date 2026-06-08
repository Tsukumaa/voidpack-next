import type { Rarity } from './card'

export interface TradeOffer {
  id: string
  direction: 'sent' | 'received'
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  offered_card_key: string
  offered_rarity: Rarity
  wanted_card_key: string
  wanted_card_name: string | null
  wanted_rarity: Rarity | null
  message: string | null
  created_at: string
  expires_at: string
}

export interface SendTradePayload {
  receiverId: string
  offeredCardId: string
  offeredCardKey: string
  offeredRarity: Rarity
  wantedCardKey: string
  wantedCardName: string
  wantedRarity: Rarity | null
  message?: string
}

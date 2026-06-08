export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'void'

export interface CardDefinition {
  id: string
  name: string
  rarity: Rarity
  family: string
  artUrl?: string
  metadata?: {
    combat?: CombatStats
    description?: string
    effects?: string[]
  }
}

export interface CombatStats {
  atk: number
  hp: number
  cost: number
  effects: string[]
}

export interface PlayerCard {
  id: string          // UUID en base
  card_id: string     // identifiant lisible
  rarity: Rarity
  family: string
  obtained_at: string
  metadata: Record<string, unknown>
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common:    '#9ca3af',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
  void:      '#7b2bff',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common:    'Commun',
  uncommon:  'Peu commun',
  rare:      'Rare',
  epic:      'Épique',
  legendary: 'Légendaire',
  void:      'VOID',
}

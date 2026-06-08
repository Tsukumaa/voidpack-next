export type CombatPhase = 'player' | 'enemy' | 'over'

export interface BoardCard {
  uid: string
  id: string
  name: string
  rarity: string
  atk: number
  hp: number
  currentHp: number
  cost: number
  effects: string[]
  exhausted: boolean
  shieldUsed?: boolean
}

export interface CombatState {
  playerHp: number
  enemyHp: number
  playerMana: number
  playerMaxMana: number
  enemyMana: number
  enemyMaxMana: number
  playerBoard: BoardCard[]
  enemyBoard: BoardCard[]
  playerHand: BoardCard[]
  enemyHand: BoardCard[]
  playerDeck: BoardCard[]
  enemyDeck: BoardCard[]
  phase: CombatPhase
  turn: number
  log: string
  gameOver: boolean
  winner?: 'player' | 'enemy'
}

export type CombatMode = 'bot' | 'pvp'

export interface GameSession {
  id: string
  player1_id: string
  player2_id: string | null
  status: 'waiting' | 'active' | 'finished' | 'abandoned'
  current_turn: string | null
  turn_number: number
  state: Record<string, unknown>
  winner_id: string | null
}

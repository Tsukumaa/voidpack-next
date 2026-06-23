import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const now = sql`(datetime('now'))`

// ── player_profiles ──────────────────────────────────────────────────────────
export const playerProfiles = sqliteTable('player_profiles', {
  userId:        text('user_id').primaryKey(),
  username:      text('username').notNull(),
  avatarUrl:     text('avatar_url'),
  level:         integer('level').notNull().default(1),
  xp:            integer('xp').notNull().default(0),
  packsOpened:   integer('packs_opened').notNull().default(0),
  highestRarity: text('highest_rarity'),
  voidPulls:     integer('void_pulls').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak:    integer('best_streak').notNull().default(0),
  mana:          integer('mana').notNull().default(0),
  twitchId:      text('twitch_id').unique(),
  twitchLogin:   text('twitch_login'),
  autoReveal:    integer('auto_reveal', { mode: 'boolean' }).notNull().default(false),
  role:          text('role').$type<'founder' | 'developer' | 'artist' | 'streamer'>(),
  favoriteCards: text('favorite_cards', { mode: 'json' }).$type<string[]>(),
  createdAt:     text('created_at').notNull().default(now),
  updatedAt:     text('updated_at').notNull().default(now),
})

// ── admin_users ───────────────────────────────────────────────────────────────
export const adminUsers = sqliteTable('admin_users', {
  discordId: text('discord_id').primaryKey(),
  userId:    text('user_id'),
  label:     text('label'),
  createdAt: text('created_at').notNull().default(now),
})

// ── custom_cards ──────────────────────────────────────────────────────────────
export const customCards = sqliteTable('custom_cards', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  family:      text('family').notNull().default('global'),
  rarity:      text('rarity').notNull().default('common'),
  character:   text('character'),
  artist:      text('artist'),
  artistUrl:   text('artist_url'),
  imageUrl:    text('image_url'),
  description: text('description'),
  metadata:    text('metadata').notNull().default('{}'), // JSON
  createdAt:   text('created_at').notNull().default(now),
  updatedAt:   text('updated_at').notNull().default(now),
})

export const artists = sqliteTable('artists', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull().unique(),
  url:       text('url'),
  createdAt: text('created_at').notNull().default(now),
})

// ── families ──────────────────────────────────────────────────────────────────
export const families = sqliteTable('families', {
  key:        text('key').primaryKey(),
  label:      text('label').notNull(),
  color:      text('color'),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt:  text('created_at').notNull().default(now),
})

// ── card_backs ────────────────────────────────────────────────────────────────
export const cardBacks = sqliteTable('card_backs', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  gradient:   text('gradient'),
  pattern:    text('pattern'),
  imageUrl:   text('image_url'),
  active:     integer('active', { mode: 'boolean' }).notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
  price:      integer('price').notNull().default(0),
  createdAt:  text('created_at').notNull().default(now),
})

// ── arena_backgrounds ──────────────────────────────────────────────────────────
export const arenaBackgrounds = sqliteTable('arena_backgrounds', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  imageUrl:   text('image_url'),
  gradient:   text('gradient'),
  active:     integer('active', { mode: 'boolean' }).notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
  price:      integer('price').notNull().default(0),
  createdAt:  text('created_at').notNull().default(now),
})

// ── player_cards ──────────────────────────────────────────────────────────────
export const playerCards = sqliteTable('player_cards', {
  userId:          text('user_id').notNull(),
  cardId:          text('card_id').notNull(),
  rarity:          text('rarity').notNull(),
  family:          text('family').notNull().default('global'),
  count:           integer('count').notNull().default(1),
  firstObtainedAt: text('first_obtained_at').notNull().default(now),
  lastObtainedAt:  text('last_obtained_at').notNull().default(now),
  metadata:        text('metadata').notNull().default('{}'), // JSON
}, (t) => [
  primaryKey({ columns: [t.userId, t.cardId] }),
  index('player_cards_user_id_idx').on(t.userId),
])

// ── booster_codes ─────────────────────────────────────────────────────────────
export const boosterCodes = sqliteTable('booster_codes', {
  id:                  text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code:                text('code').notNull().unique(),
  boosterType:         text('booster_type').notNull().default('void'),
  status:              text('status').notNull().default('active'),
  maxRedemptions:      integer('max_redemptions').notNull().default(1),
  redeemedCount:       integer('redeemed_count').notNull().default(0),
  expiresAt:           text('expires_at'),
  createdBy:           text('created_by'),
  twitchBroadcasterId: text('twitch_broadcaster_id'),
  createdAt:           text('created_at').notNull().default(now),
  metadata:            text('metadata').notNull().default('{}'), // JSON
}, (t) => [
  index('booster_codes_code_idx').on(t.code),
])

// ── booster_code_redemptions ──────────────────────────────────────────────────
export const boosterCodeRedemptions = sqliteTable('booster_code_redemptions', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  codeId:      text('code_id').notNull(),
  userId:      text('user_id').notNull(),
  status:      text('status').notNull().default('pending'),
  redeemedAt:  text('redeemed_at').notNull().default(now),
  completedAt: text('completed_at'),
  cards:       text('cards').notNull().default('[]'), // JSON
  metadata:    text('metadata').notNull().default('{}'), // JSON
}, (t) => [
  uniqueIndex('booster_redemptions_one_per_user_code_idx').on(t.codeId, t.userId),
])

// ── booster_credits ───────────────────────────────────────────────────────────
export const boosterCredits = sqliteTable('booster_credits', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      text('user_id').notNull(),
  boosterType: text('booster_type').notNull().default('void'),
  source:      text('source').notNull().default('manual'),
  sourceRef:   text('source_ref').unique(),
  claimed:     integer('claimed', { mode: 'boolean' }).notNull().default(false),
  claimedAt:   text('claimed_at'),
  createdAt:   text('created_at').notNull().default(now),
  createdBy:   text('created_by'),
}, (t) => [
  index('idx_booster_credits_user').on(t.userId),
])

// ── player_pity_state ─────────────────────────────────────────────────────────
export const playerPityState = sqliteTable('player_pity_state', {
  userId:              text('user_id').primaryKey(),
  packsSinceLegendary: integer('packs_since_legendary').notNull().default(0),
  packsSinceVoid:      integer('packs_since_void').notNull().default(0),
  totalPacksOpened:    integer('total_packs_opened').notNull().default(0),
  lastLegendaryAt:     text('last_legendary_at'),
  lastVoidAt:          text('last_void_at'),
  updatedAt:           text('updated_at').notNull().default(now),
})

// ── player_daily_rewards ──────────────────────────────────────────────────────
export const playerDailyRewards = sqliteTable('player_daily_rewards', {
  userId:        text('user_id').primaryKey(),
  lastClaimAt:   text('last_claim_at'),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak:    integer('best_streak').notNull().default(0),
  createdAt:     text('created_at').notNull().default(now),
  updatedAt:     text('updated_at').notNull().default(now),
})

// ── player_daily_missions ─────────────────────────────────────────────────────
export const playerDailyMissions = sqliteTable('player_daily_missions', {
  userId:    text('user_id').notNull(),
  date:      text('date').notNull(),           // YYYY-MM-DD
  missionId: text('mission_id').notNull(),
  progress:  integer('progress').notNull().default(0),
  claimed:   integer('claimed', { mode: 'boolean' }).notNull().default(false),
  claimedAt: text('claimed_at'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
}, (t) => [
  primaryKey({ columns: [t.userId, t.date, t.missionId] }),
  index('pdm_user_date_idx').on(t.userId, t.date),
])

// ── player_achievements ───────────────────────────────────────────────────────
export const playerAchievements = sqliteTable('player_achievements', {
  userId:        text('user_id').notNull(),
  achievementId: text('achievement_id').notNull(),
  unlockedAt:    text('unlocked_at').notNull().default(now),
}, (t) => [
  uniqueIndex('player_achievements_pk').on(t.userId, t.achievementId),
])

// ── game_sessions ─────────────────────────────────────────────────────────────
export const gameSessions = sqliteTable('game_sessions', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  player1Id:   text('player1_id').notNull(),
  player2Id:   text('player2_id'),
  status:      text('status').notNull().default('waiting'),
  currentTurn: text('current_turn'),
  turnNumber:  integer('turn_number').notNull().default(1),
  state:       text('state').notNull().default('{}'), // JSON
  winnerId:    text('winner_id'),
  createdAt:   text('created_at').notNull().default(now),
  updatedAt:   text('updated_at').notNull().default(now),
  finishedAt:  text('finished_at'),
})

// ── matchmaking_queue ─────────────────────────────────────────────────────────
export const matchmakingQueue = sqliteTable('matchmaking_queue', {
  userId:   text('user_id').primaryKey(),
  deck:     text('deck').notNull(), // JSON
  joinedAt: text('joined_at').notNull().default(now),
})

// ── combat_stats ──────────────────────────────────────────────────────────────
export const combatStats = sqliteTable('combat_stats', {
  userId:        text('user_id').primaryKey(),
  wins:          integer('wins').notNull().default(0),
  losses:        integer('losses').notNull().default(0),
  rankPoints:    integer('rank_points').notNull().default(0),
  peakPoints:    integer('peak_points').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak:    integer('best_streak').notNull().default(0),
  seasonWins:    integer('season_wins').notNull().default(0),
  seasonLosses:  integer('season_losses').notNull().default(0),
  updatedAt:     text('updated_at').notNull().default(now),
})

// ── friendships ───────────────────────────────────────────────────────────────
export const friendships = sqliteTable('friendships', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  senderId:   text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  status:     text('status').notNull().default('pending'),
  createdAt:  text('created_at').notNull().default(now),
  updatedAt:  text('updated_at').notNull().default(now),
}, (t) => [
  uniqueIndex('friendships_unique').on(t.senderId, t.receiverId),
])

// ── direct_messages ───────────────────────────────────────────────────────────
export const directMessages = sqliteTable('direct_messages', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  senderId:   text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  content:    text('content').notNull(),
  readAt:     text('read_at'),
  createdAt:  text('created_at').notNull().default(now),
})

// ── trade_offers ──────────────────────────────────────────────────────────────
export const tradeOffers = sqliteTable('trade_offers', {
  id:              text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId:        text('sender_id').notNull(),
  receiverId:      text('receiver_id').notNull(),
  offeredCardId:   text('offered_card_id'),
  offeredCardKey:  text('offered_card_key').notNull(),
  offeredRarity:   text('offered_rarity').notNull(),
  wantedCardKey:   text('wanted_card_key').notNull(),
  wantedRarity:    text('wanted_rarity'),
  wantedCardName:  text('wanted_card_name'),
  status:          text('status').notNull().default('pending'),
  message:         text('message'),
  createdAt:       text('created_at').notNull().default(now),
  expiresAt:       text('expires_at'),
  respondedAt:     text('responded_at'),
})

// ── twitch_pending_codes ──────────────────────────────────────────────────────
export const twitchPendingCodes = sqliteTable('twitch_pending_codes', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  twitchUserId:     text('twitch_user_id').notNull(),
  userId:           text('user_id'),
  code:             text('code').notNull(),
  boosterType:      text('booster_type').notNull().default('void'),
  broadcasterLogin: text('broadcaster_login'),
  broadcasterId:    text('broadcaster_id'),
  claimed:          integer('claimed', { mode: 'boolean' }).notNull().default(false),
  claimedAt:        text('claimed_at'),
  createdAt:        text('created_at').notNull().default(now),
})

// ── twitch_streamers ──────────────────────────────────────────────────────────
// Chaînes Twitch connectées via OAuth (scope channel:read:redemptions).
// Les tokens permettent de (re)créer les abonnements EventSub.
export const twitchStreamers = sqliteTable('twitch_streamers', {
  broadcasterId:    text('broadcaster_id').primaryKey(),
  broadcasterLogin: text('broadcaster_login').notNull(),
  userId:           text('user_id'),                 // compte VOID du streamer (Discord id)
  accessToken:      text('access_token'),
  refreshToken:     text('refresh_token'),
  scope:            text('scope'),
  active:           integer('active', { mode: 'boolean' }).notNull().default(true),
  subscriptionId:   text('subscription_id'),          // id de l'abonnement EventSub
  createdAt:        text('created_at').notNull().default(now),
  updatedAt:        text('updated_at').notNull().default(now),
})

// ── twitch_rewards ────────────────────────────────────────────────────────────
// Mapping reward Channel Points → type de booster. boosterType null = non mappé
// (auto-découvert lors d'une première utilisation, à mapper dans l'admin).
export const twitchRewards = sqliteTable('twitch_rewards', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  broadcasterId: text('broadcaster_id').notNull(),
  rewardId:      text('reward_id').notNull(),
  rewardTitle:   text('reward_title'),
  rewardCost:    integer('reward_cost'),
  boosterType:   text('booster_type'),                // null = pas encore mappé
  quantity:      integer('quantity').notNull().default(1),
  active:        integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt:     text('created_at').notNull().default(now),
  updatedAt:     text('updated_at').notNull().default(now),
}, (t) => [
  uniqueIndex('idx_twitch_rewards_unique').on(t.broadcasterId, t.rewardId),
])

// ── game_actions ──────────────────────────────────────────────────────────────
export const gameActions = sqliteTable('game_actions', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  sessionId:  text('session_id').notNull(),
  playerId:   text('player_id').notNull(),
  actionType: text('action_type').notNull(),
  payload:    text('payload').notNull().default('{}'),
  createdAt:  text('created_at').notNull().default(now),
}, (t) => [
  index('game_actions_session_idx').on(t.sessionId),
])

// ── game_challenges ───────────────────────────────────────────────────────────
export const gameChallenges = sqliteTable('game_challenges', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  challengerId: text('challenger_id').notNull(),
  challengedId: text('challenged_id').notNull(),
  deck:        text('deck').notNull().default('[]'), // JSON
  status:      text('status').notNull().default('pending'), // pending|accepted|declined|cancelled
  sessionId:   text('session_id'),
  createdAt:   text('created_at').notNull().default(now),
  updatedAt:   text('updated_at').notNull().default(now),
}, (t) => [
  index('game_challenges_challenged_idx').on(t.challengedId),
  index('game_challenges_challenger_idx').on(t.challengerId),
])

// ── saved_decks ───────────────────────────────────────────────────────────────
export const savedDecks = sqliteTable('saved_decks', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text('user_id').notNull(),
  name:      text('name').notNull(),
  cards:     text('cards').notNull().default('[]'), // JSON SelectedEntry[]
  totalCards: integer('total_cards').notNull().default(0),
  totalMana:  integer('total_mana').notNull().default(0),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
})

// ── settings ──────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
})

// ── kanban_cards ──────────────────────────────────────────────────────────────
export const kanbanCards = sqliteTable('kanban_cards', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title:       text('title').notNull(),
  description: text('description'),
  column:      text('column').notNull().default('todo'),
  tag:         text('tag'),
  position:    integer('position').notNull().default(0),
  attachment:  text('attachment'),
  createdBy:   text('created_by'),
  createdAt:   text('created_at').notNull().default(now),
  updatedAt:   text('updated_at').notNull().default(now),
})

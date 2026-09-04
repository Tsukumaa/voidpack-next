/**
 * Seed local dev database with fake data.
 * Run: npx tsx scripts/seed.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../src/lib/db/schema'

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})
const db = drizzle(client, { schema })

// ── helpers ──────────────────────────────────────────────────────────────────

function uid(n: number) { return `seed_user_${n}` }

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'void'] as const
const FAMILIES = ['fire', 'water', 'earth', 'wind', 'shadow', 'light'] as const
const ROLES    = ['founder', 'developer', 'artist', 'streamer', null, null, null] as const

const FAKE_CARDS = [
  { id: 'card_ember',    name: 'Ember Knight',     rarity: 'common',    family: 'fire',   cost: 2, atk: 3, def: 2 },
  { id: 'card_tidal',   name: 'Tidal Serpent',     rarity: 'uncommon',  family: 'water',  cost: 3, atk: 4, def: 3 },
  { id: 'card_boulder', name: 'Boulder Golem',      rarity: 'rare',      family: 'earth',  cost: 4, atk: 5, def: 6 },
  { id: 'card_gale',    name: 'Gale Hawk',          rarity: 'epic',      family: 'wind',   cost: 3, atk: 6, def: 2 },
  { id: 'card_shadow',  name: 'Shadow Stalker',     rarity: 'legendary', family: 'shadow', cost: 5, atk: 7, def: 5 },
  { id: 'card_void',    name: 'Void Reaper',        rarity: 'void',      family: 'light',  cost: 7, atk: 9, def: 7 },
  { id: 'card_spark',   name: 'Spark Imp',          rarity: 'common',    family: 'fire',   cost: 1, atk: 2, def: 1 },
  { id: 'card_frost',   name: 'Frost Drake',        rarity: 'rare',      family: 'water',  cost: 4, atk: 5, def: 4 },
  { id: 'card_stone',   name: 'Stone Sentinel',     rarity: 'uncommon',  family: 'earth',  cost: 2, atk: 2, def: 5 },
  { id: 'card_zephyr',  name: 'Zephyr Blade',       rarity: 'epic',      family: 'wind',   cost: 4, atk: 7, def: 3 },
] as const

const FAKE_USERS = [
  { n: 1, username: 'tsu_kuma',    level: 42, xp: 18400, highestRarity: 'void',      voidPulls: 3,  packs: 120, streak: 15, role: 'founder',   isSubscriber: true  },
  { n: 2, username: 'b_alvd',      level: 38, xp: 14200, highestRarity: 'legendary', voidPulls: 1,  packs: 94,  streak: 7,  role: 'developer',  isSubscriber: true  },
  { n: 3, username: 'AkiraStorm',  level: 25, xp: 8300,  highestRarity: 'epic',      voidPulls: 0,  packs: 60,  streak: 4,  role: null,         isSubscriber: true  },
  { n: 4, username: 'LunaWolf',    level: 18, xp: 4900,  highestRarity: 'rare',      voidPulls: 0,  packs: 35,  streak: 2,  role: null,         isSubscriber: false },
  { n: 5, username: 'NovaMage',    level: 12, xp: 2100,  highestRarity: 'uncommon',  voidPulls: 0,  packs: 18,  streak: 0,  role: null,         isSubscriber: false },
  { n: 6, username: 'PyroKnight',  level: 8,  xp: 1050,  highestRarity: 'common',    voidPulls: 0,  packs: 9,   streak: 1,  role: null,         isSubscriber: false },
  { n: 7, username: 'FrostByte',   level: 5,  xp: 450,   highestRarity: 'common',    voidPulls: 0,  packs: 5,   streak: 0,  role: null,         isSubscriber: false },
  { n: 8, username: 'VoidSeeker',  level: 31, xp: 10800, highestRarity: 'legendary', voidPulls: 0,  packs: 78,  streak: 9,  role: 'streamer',   isSubscriber: true  },
  { n: 9, username: 'ShadowPulse', level: 1,  xp: 0,     highestRarity: null,        voidPulls: 0,  packs: 0,   streak: 0,  role: null,         isSubscriber: false },
  { n: 10, username: 'GaleRider',  level: 22, xp: 6700,  highestRarity: 'epic',      voidPulls: 0,  packs: 44,  streak: 3,  role: 'artist',     isSubscriber: false },
]

// Cards each user owns (by card index 0-9)
const USER_CARDS: Record<number, number[]> = {
  1:  [0,1,2,3,4,5,6,7,8,9],  // tsu_kuma — all cards
  2:  [0,1,2,3,4,5,6,7,8],    // b_alvd — missing zephyr
  3:  [0,1,2,3,5,6,7],
  4:  [0,1,2,6,7,8],
  5:  [0,1,6],
  6:  [0,6],
  7:  [0],
  8:  [0,1,2,3,4,6,7,8,9],
  9:  [],                       // new user — no cards
  10: [0,1,2,3,6,7,8],
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding dev database…')

  // 1. Cards
  console.log('  → custom_cards')
  for (const c of FAKE_CARDS) {
    await db.insert(schema.customCards)
      .values({
        id: c.id, name: c.name, rarity: c.rarity, family: c.family,
        description: `Une carte ${c.rarity} de la famille ${c.family}.`,
        metadata: JSON.stringify({ cost: c.cost, atk: c.atk, def: c.def }),
      })
      .onConflictDoNothing()
  }

  // 2. Families
  console.log('  → families')
  const familyColors: Record<string, string> = {
    fire: '#ef4444', water: '#3b82f6', earth: '#84cc16',
    wind: '#a3e635', shadow: '#7c3aed', light: '#fbbf24',
  }
  for (const key of FAMILIES) {
    await db.insert(schema.families)
      .values({ key, label: key.charAt(0).toUpperCase() + key.slice(1), color: familyColors[key], orderIndex: FAMILIES.indexOf(key) })
      .onConflictDoNothing()
  }

  // 3. Players + cards + combat stats
  console.log('  → player_profiles + player_cards + combat_stats')
  for (const u of FAKE_USERS) {
    const userId = uid(u.n)
    const subscriberUntil = u.isSubscriber
      ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      : null

    await db.insert(schema.playerProfiles)
      .values({
        userId,
        username:      u.username,
        avatarUrl:     `https://api.dicebear.com/8.x/pixel-art/svg?seed=${u.username}`,
        level:         u.level,
        xp:            u.xp,
        packsOpened:   u.packs,
        highestRarity: u.highestRarity ?? undefined,
        voidPulls:     u.voidPulls,
        currentStreak: u.streak,
        bestStreak:    Math.max(u.streak, u.streak + 2),
        role:          (u.role as typeof schema.playerProfiles.$inferInsert['role']) ?? undefined,
        isSubscriber:  u.isSubscriber,
        subscriberUntil,
        twitchId:      userId,
        twitchLogin:   u.username.toLowerCase(),
      })
      .onConflictDoNothing()

    // Player cards
    const cardIndices = USER_CARDS[u.n] ?? []
    for (const idx of cardIndices) {
      const card = FAKE_CARDS[idx]
      await db.insert(schema.playerCards)
        .values({
          userId,
          cardId: card.id,
          rarity: card.rarity,
          family: card.family,
          count: idx === 0 ? 3 : 1,
        })
        .onConflictDoNothing()
    }

    // Combat stats
    const wins   = Math.floor(u.xp / 300)
    const losses = Math.floor(u.xp / 500)
    await db.insert(schema.combatStats)
      .values({
        userId,
        wins,
        losses,
        rankPoints: wins * 15 - losses * 10,
        peakPoints: wins * 16,
      })
      .onConflictDoNothing()
  }

  // 4. Trade offers
  console.log('  → trade_offers')
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const ME = '188539138' // b_alvd — ton vrai user ID
  const trades = [
    // AkiraStorm t'envoie un trade (reçu)
    { senderId: uid(3), receiverId: ME,     offeredCardId: 'card_boulder', offeredCardKey: 'card_boulder', offeredRarity: 'rare',      wantedCardKey: 'card_void',   wantedCardName: 'Void Reaper',    wantedRarity: 'void',      message: 'PTDDDDDR Donne moi ça il me revient de droit' },
    // LunaWolf t'envoie un trade (reçu)
    { senderId: uid(4), receiverId: ME,     offeredCardId: 'card_tidal',   offeredCardKey: 'card_tidal',   offeredRarity: 'uncommon',  wantedCardKey: 'card_shadow', wantedCardName: 'Shadow Stalker', wantedRarity: 'legendary', message: null },
    // Tu envoies un trade à tsu_kuma (envoyé)
    { senderId: ME,     receiverId: uid(1), offeredCardId: 'card_ember',   offeredCardKey: 'card_ember',   offeredRarity: 'common',    wantedCardKey: 'card_zephyr', wantedCardName: 'Zephyr Blade',   wantedRarity: 'epic',      message: 'Caca' },
    // Tu envoies un trade à VoidSeeker (envoyé)
    { senderId: ME,     receiverId: uid(8), offeredCardId: 'card_frost',   offeredCardKey: 'card_frost',   offeredRarity: 'rare',      wantedCardKey: 'card_gale',   wantedCardName: 'Gale Hawk',      wantedRarity: 'epic',      message: 'Deal ?' },
  ]
  for (const t of trades) {
    await db.insert(schema.tradeOffers)
      .values({ ...t, expiresAt })
      .onConflictDoNothing()
  }

  // 5. Market offers
  console.log('  → market_offers')
  const marketExpires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const marketOffers = [
    // tsu_kuma offre un Void Reaper contre un Zephyr Blade
    { sellerId: uid(1), offeredCardKey: 'card_void',    offeredRarity: 'void',      wantedCardKey: 'card_zephyr',  wantedCardName: 'Zephyr Blade',   wantedRarity: 'epic',      message: 'Le Void pour un Zephyr, qui veut ?' },
    // AkiraStorm offre un Boulder Golem contre un Shadow Stalker
    { sellerId: uid(3), offeredCardKey: 'card_boulder', offeredRarity: 'rare',      wantedCardKey: 'card_shadow',  wantedCardName: 'Shadow Stalker', wantedRarity: 'legendary', message: null },
    // LunaWolf offre un Frost Drake contre n'importe quel légendaire
    { sellerId: uid(4), offeredCardKey: 'card_frost',   offeredRarity: 'rare',      wantedCardKey: 'card_shadow',  wantedCardName: 'Shadow Stalker', wantedRarity: 'legendary', message: 'Frost contre légendaire, open !' },
    // VoidSeeker offre un Gale Hawk contre un Void Reaper
    { sellerId: uid(8), offeredCardKey: 'card_gale',    offeredRarity: 'epic',      wantedCardKey: 'card_void',    wantedCardName: 'Void Reaper',    wantedRarity: 'void',      message: 'Qui a un Void ? Je donne mon Gale' },
    // GaleRider offre un Tidal Serpent contre un Spark Imp (échange simple)
    { sellerId: uid(10), offeredCardKey: 'card_tidal',  offeredRarity: 'uncommon',  wantedCardKey: 'card_spark',   wantedCardName: 'Spark Imp',      wantedRarity: 'common',    message: null },
  ]
  for (const o of marketOffers) {
    await db.insert(schema.marketOffers)
      .values({ ...o, status: 'open', expiresAt: marketExpires })
      .onConflictDoNothing()
  }

  // 6. Friendship (user 1 & 2 amis, user 3 a envoyé une demande à user 1)
  console.log('  → friendships')
  await db.insert(schema.friendships)
    .values({ senderId: uid(1), receiverId: uid(2), status: 'accepted' })
    .onConflictDoNothing()
  await db.insert(schema.friendships)
    .values({ senderId: uid(3), receiverId: uid(1), status: 'pending' })
    .onConflictDoNothing()

  // 7. Settings
  console.log('  → settings')
  await db.insert(schema.settings)
    .values({ key: 'maintenance_mode', value: 'false' })
    .onConflictDoNothing()

  console.log('✅ Done! 10 users, 10 cards, 4 trades, 5 market offers, friendships.')
  console.log('\nUser IDs for testing:')
  for (const u of FAKE_USERS) {
    console.log(`  ${uid(u.n).padEnd(14)} → ${u.username} (lv.${u.level})`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })

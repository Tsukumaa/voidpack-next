import { dbClient } from '@/lib/db'
import { MANA_PER_RARITY } from '@/lib/game/mana-constants'

// ── Marché : vente de cartes contre du mana ──────────────────────────────────
// Mise en vente : la carte quitte la collection du vendeur (séquestre).
// Achat : l'acheteur paie le prix, le vendeur reçoit le prix moins la commission.
// Annulation / expiration : la carte revient au vendeur.
// Toutes les opérations qui déplacent cartes ou mana passent par une transaction
// d'écriture : une carte ne peut être ni vendue deux fois, ni perdue.

export const MARKET_COMMISSION   = 0.10   // 10 % retirés du jeu à chaque vente
export const MARKET_DURATION_DAYS = 7
export const MARKET_MAX_PRICE    = 100_000
export const MARKET_MAX_OPEN     = 20     // ventes ouvertes simultanées par joueur

// Prix plancher = valeur de recyclage : vendre ne rapporte jamais moins que recycler
export function marketMinPrice(rarity: string): number {
  return Math.max(1, MANA_PER_RARITY[rarity] ?? 1)
}

export function sellerGainFor(price: number): number {
  return Math.floor(price * (1 - MARKET_COMMISSION))
}

export class MarketError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const nowIso = () => new Date().toISOString()

// Remet une carte dans la collection d'un joueur (+1 exemplaire)
const RETURN_CARD_SQL = `INSERT INTO player_cards (user_id, card_id, rarity, family, count)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(user_id, card_id) DO UPDATE SET count = count + 1, last_obtained_at = datetime('now')`

// Mise en vente : retire 1 exemplaire de la collection et crée l'offre
export async function createListing(sellerId: string, card: { id: string; rarity: string; family: string }, price: number) {
  const tx = await dbClient.transaction('write')
  try {
    const open = await tx.execute({ sql: `SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ? AND status = 'open'`, args: [sellerId] })
    if (Number(open.rows[0].n) >= MARKET_MAX_OPEN) throw new MarketError(`Tu as déjà ${MARKET_MAX_OPEN} cartes en vente.`)

    const owned = await tx.execute({ sql: `SELECT count FROM player_cards WHERE user_id = ? AND card_id = ?`, args: [sellerId, card.id] })
    const count = Number(owned.rows[0]?.count ?? 0)
    if (count < 1) throw new MarketError('Tu ne possèdes pas cette carte.')

    if (count === 1) await tx.execute({ sql: `DELETE FROM player_cards WHERE user_id = ? AND card_id = ?`, args: [sellerId, card.id] })
    else await tx.execute({ sql: `UPDATE player_cards SET count = count - 1 WHERE user_id = ? AND card_id = ?`, args: [sellerId, card.id] })

    const id = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + MARKET_DURATION_DAYS * 86400_000).toISOString()
    await tx.execute({
      sql: `INSERT INTO market_listings (id, seller_id, card_id, rarity, family, price, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      args: [id, sellerId, card.id, card.rarity, card.family, price, expiresAt],
    })
    await tx.commit()
    return { id, expiresAt }
  } catch (e) {
    await tx.rollback().catch(() => {})
    throw e
  } finally {
    tx.close()
  }
}

// Achat : débite l'acheteur, crédite le vendeur (moins la commission), donne la carte
export async function buyListing(buyerId: string, listingId: string) {
  const tx = await dbClient.transaction('write')
  try {
    const res = await tx.execute({ sql: `SELECT * FROM market_listings WHERE id = ?`, args: [listingId] })
    const l = res.rows[0]
    if (!l || l.status !== 'open' || String(l.expires_at) <= nowIso()) throw new MarketError('Cette carte n\'est plus en vente.', 404)
    if (l.seller_id === buyerId) throw new MarketError('Tu ne peux pas acheter ta propre carte.')

    const price = Number(l.price)
    const gain  = sellerGainFor(price)
    const debit = await tx.execute({ sql: `UPDATE player_profiles SET mana = mana - ? WHERE user_id = ? AND mana >= ?`, args: [price, buyerId, price] })
    if (debit.rowsAffected !== 1) throw new MarketError('Pas assez de mana.')

    await tx.execute({ sql: `UPDATE player_profiles SET mana = mana + ? WHERE user_id = ?`, args: [gain, String(l.seller_id)] })
    await tx.execute({ sql: RETURN_CARD_SQL, args: [buyerId, String(l.card_id), String(l.rarity), String(l.family)] })
    await tx.execute({
      sql: `UPDATE market_listings SET status = 'sold', buyer_id = ?, seller_gain = ?, closed_at = ? WHERE id = ?`,
      args: [buyerId, gain, nowIso(), listingId],
    })
    const mana = await tx.execute({ sql: `SELECT mana FROM player_profiles WHERE user_id = ?`, args: [buyerId] })
    await tx.commit()
    return { cardId: String(l.card_id), price, manaRemaining: Number(mana.rows[0]?.mana ?? 0) }
  } catch (e) {
    await tx.rollback().catch(() => {})
    throw e
  } finally {
    tx.close()
  }
}

// Annulation par le vendeur : la carte lui revient
export async function cancelListing(sellerId: string, listingId: string) {
  const tx = await dbClient.transaction('write')
  try {
    const res = await tx.execute({ sql: `SELECT * FROM market_listings WHERE id = ? AND seller_id = ?`, args: [listingId, sellerId] })
    const l = res.rows[0]
    if (!l || l.status !== 'open') throw new MarketError('Cette vente n\'est plus active.', 404)
    await tx.execute({ sql: RETURN_CARD_SQL, args: [sellerId, String(l.card_id), String(l.rarity), String(l.family)] })
    await tx.execute({ sql: `UPDATE market_listings SET status = 'cancelled', closed_at = ? WHERE id = ?`, args: [nowIso(), listingId] })
    await tx.commit()
  } catch (e) {
    await tx.rollback().catch(() => {})
    throw e
  } finally {
    tx.close()
  }
}

// Expiration paresseuse (appelée à l'affichage du marché) : les cartes reviennent aux vendeurs
export async function expireListings() {
  const now = nowIso()
  // Lecture hors transaction : on ne lance une transaction que s'il y a quelque chose à faire
  const due = await dbClient.execute({ sql: `SELECT 1 FROM market_listings WHERE status = 'open' AND expires_at <= ? LIMIT 1`, args: [now] })
  if (!due.rows.length) return
  const tx = await dbClient.transaction('write')
  try {
    const expired = await tx.execute({
      sql: `UPDATE market_listings SET status = 'expired', closed_at = ? WHERE status = 'open' AND expires_at <= ?
            RETURNING seller_id, card_id, rarity, family`,
      args: [now, now],
    })
    for (const l of expired.rows) {
      await tx.execute({ sql: RETURN_CARD_SQL, args: [String(l.seller_id), String(l.card_id), String(l.rarity), String(l.family)] })
    }
    await tx.commit()
  } catch (e) {
    await tx.rollback().catch(() => {})
    console.error('market expire error:', e)
  } finally {
    tx.close()
  }
}

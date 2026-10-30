import { dbClient } from '@/lib/db'

// ── Trades publics : "j'offre X contre Y", n'importe quel joueur peut accepter ─
// (table market_offers). Pas de mise de côté : les deux cartes sont vérifiées et
// échangées au moment de l'acceptation, dans une seule transaction.

export const PUBLIC_TRADE_DURATION_DAYS = 7
export const PUBLIC_TRADE_MAX_OPEN = 10 // trades publics ouverts simultanés par joueur

export class TradeError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const nowIso = () => new Date().toISOString()

// Donne 1 exemplaire d'une carte à un joueur
const GIVE_CARD_SQL = `INSERT INTO player_cards (user_id, card_id, rarity, family, count)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(user_id, card_id) DO UPDATE SET count = count + 1, last_obtained_at = datetime('now')`

type Tx = Awaited<ReturnType<typeof dbClient.transaction>>

// Retire 1 exemplaire d'une carte à un joueur ; renvoie rareté/famille, ou null s'il ne l'a pas
async function takeCard(tx: Tx, userId: string, cardId: string) {
  const res = await tx.execute({ sql: `SELECT count, rarity, family FROM player_cards WHERE user_id = ? AND card_id = ?`, args: [userId, cardId] })
  const row = res.rows[0]
  if (!row || Number(row.count) < 1) return null
  if (Number(row.count) === 1) await tx.execute({ sql: `DELETE FROM player_cards WHERE user_id = ? AND card_id = ?`, args: [userId, cardId] })
  else await tx.execute({ sql: `UPDATE player_cards SET count = count - 1 WHERE user_id = ? AND card_id = ?`, args: [userId, cardId] })
  return { rarity: String(row.rarity), family: String(row.family) }
}

// Acceptation : le vendeur donne la carte offerte, l'acceptant donne la carte demandée
export async function acceptPublicTrade(userId: string, offerId: string) {
  const tx = await dbClient.transaction('write')
  try {
    const res = await tx.execute({ sql: `SELECT * FROM market_offers WHERE id = ?`, args: [offerId] })
    const o = res.rows[0]
    if (!o || o.status !== 'open' || (o.expires_at && String(o.expires_at) <= nowIso()))
      throw new TradeError('Ce trade n\'est plus disponible.', 404)
    if (o.seller_id === userId) throw new TradeError('Tu ne peux pas accepter ton propre trade.')

    const sellerId = String(o.seller_id)
    const offered  = String(o.offered_card_key)
    const wanted   = String(o.wanted_card_key)

    const fromBuyer = await takeCard(tx, userId, wanted)
    if (!fromBuyer) throw new TradeError('Tu ne possèdes pas la carte demandée.')
    const fromSeller = await takeCard(tx, sellerId, offered)
    if (!fromSeller) {
      // Le vendeur n'a plus la carte : le trade est fermé
      await tx.rollback()
      await dbClient.execute({ sql: `UPDATE market_offers SET status = 'cancelled' WHERE id = ? AND status = 'open'`, args: [offerId] })
      throw new TradeError('Le joueur ne possède plus cette carte, le trade a été retiré.')
    }

    await tx.execute({ sql: GIVE_CARD_SQL, args: [userId, offered, fromSeller.rarity, fromSeller.family] })
    await tx.execute({ sql: GIVE_CARD_SQL, args: [sellerId, wanted, fromBuyer.rarity, fromBuyer.family] })
    await tx.execute({
      sql: `UPDATE market_offers SET status = 'accepted', buyer_id = ?, accepted_at = ? WHERE id = ?`,
      args: [userId, nowIso(), offerId],
    })
    await tx.commit()
    return { sellerId, offered, wanted }
  } catch (e) {
    await tx.rollback().catch(() => {})
    throw e
  } finally {
    tx.close()
  }
}

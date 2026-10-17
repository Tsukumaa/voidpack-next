// Signal côté navigateur : une action susceptible de compter pour le raid vient
// d'être faite. La jauge du header l'écoute et ne se met à jour (1 requête) que
// si le type d'action correspond à l'objectif du raid en cours.
export const RAID_ACTIVITY_EVENT = 'voidpack:raid-activity'

export type RaidActivityType = 'boosters_opened' | 'combats_won' | 'cards_recycled' | 'trades_completed'

export function notifyRaidActivity(type: RaidActivityType) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RAID_ACTIVITY_EVENT, { detail: type }))
}

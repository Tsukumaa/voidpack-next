// Signal côté navigateur : le joueur vient d'infliger des dégâts au boss du raid
// (booster ouvert, mission quotidienne réclamée). La bannière du raid l'écoute pour
// se mettre à jour tout de suite (1 requête) au lieu d'attendre le prochain poll.
export const RAID_ACTIVITY_EVENT = 'voidpack:raid-activity'

export function notifyRaidActivity() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RAID_ACTIVITY_EVENT))
}

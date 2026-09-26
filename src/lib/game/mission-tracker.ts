// Toutes les mutations de missions passent par l'API (stockage DB).
// Ces fonctions restent pour la compatibilité des appels depuis BoosterOpening/PackScreen.

export async function trackMissionProgress(userId: string, eventType: string, count = 1) {
  if (!userId) return
  try {
    await fetch('/api/profile/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId: eventType, count }),
    })
  } catch { /* best-effort */ }
}

// Envoie plusieurs événements en une seule requête (batch)
export async function trackMissions(userId: string, events: { missionId: string; count?: number }[]) {
  if (!userId || events.length === 0) return
  try {
    await fetch('/api/profile/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    })
  } catch { /* best-effort */ }
}


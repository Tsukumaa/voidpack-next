function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function progressKey(userId: string) {
  return `voidpack_missions_${todayKey()}_${userId}`
}

function claimedKey(userId: string) {
  return `voidpack_claimed_${todayKey()}_${userId}`
}

export function trackMissionProgress(userId: string, eventType: string, count = 1) {
  if (typeof window === 'undefined') return
  const key = progressKey(userId)
  const data = JSON.parse(localStorage.getItem(key) || '{}')
  data[eventType] = (data[eventType] || 0) + count
  localStorage.setItem(key, JSON.stringify(data))
}

export function getMissionProgress(userId: string, eventType: string): number {
  if (typeof window === 'undefined') return 0
  const data = JSON.parse(localStorage.getItem(progressKey(userId)) || '{}')
  return data[eventType] || 0
}

export function getClaimedMissions(userId: string): string[] {
  if (typeof window === 'undefined') return []
  return JSON.parse(localStorage.getItem(claimedKey(userId)) || '[]')
}

export function markMissionClaimed(userId: string, missionId: string) {
  if (typeof window === 'undefined') return
  const key = claimedKey(userId)
  const claimed: string[] = JSON.parse(localStorage.getItem(key) || '[]')
  if (!claimed.includes(missionId)) {
    claimed.push(missionId)
    localStorage.setItem(key, JSON.stringify(claimed))
  }
}

/**
 * settings.js — Paramètres globaux VOID Pack
 */

let _settings = {};

export function getSetting(key, fallback = '') {
  return _settings[key] ?? fallback;
}

export async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error(await res.text());
    _settings = await res.json();
    console.info('[VOID Pack] Settings chargés:', Object.keys(_settings).length);
  } catch (e) {
    console.warn('[VOID Pack] Settings fallback:', e?.message);
  }
}

export async function saveSetting(key, value) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(await res.text());
  _settings[key] = value;
}

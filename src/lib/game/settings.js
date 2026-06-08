/**
 * settings.js — Paramètres globaux VOID Pack depuis Supabase
 */
import { getSupabaseClient } from '@/lib/supabase/client';

let _settings = {};

export function getSetting(key, fallback = '') {
  return _settings[key] ?? fallback;
}

export async function loadSettings() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('get_void_settings');
    if (error) throw error;
    if (data) {
      _settings = {};
      for (const row of data) _settings[row.key] = row.value;
    }
    console.info('[VOID Pack] Settings chargés:', Object.keys(_settings).length);
  } catch (e) {
    console.warn('[VOID Pack] Settings fallback:', e?.message);
  }
}

export async function saveSetting(key, value) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('set_void_setting', { p_key: key, p_value: value });
  if (error) throw error;
  _settings[key] = value;
}

import { getSupabaseClient } from '@/lib/supabase/client';
import { setFamilyRegistry } from '@/lib/game/families-registry';

export { getFamRegistry as getFamilies, getFamOrder as getFamilyOrder, getFam as getFamily } from '@/lib/game/families-registry';
import { getFamRegistry, getFamOrder, getFam } from '@/lib/game/families-registry';

let _loaded = false;

export async function loadFamilies() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('list_void_families');
    if (error) throw error;
    if (!data?.length) return;
    const families = {};
    const order = [];
    for (const row of data) {
      families[row.key] = Object.freeze({ key: row.key, label: row.label, color: row.color, description: row.description });
      order.push(row.key);
    }
    setFamilyRegistry(families, order);
    _loaded = true;
    console.info('[VOID Pack] Familles chargées :', Object.keys(families).length);
  } catch (e) {
    console.warn('[VOID Pack] Familles fallback :', e?.message);
  }
}

export async function upsertFamily({ key, label, color, description, sort_order = 99 }) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('upsert_void_family', { p_key: key, p_label: label, p_color: color, p_description: description, p_sort_order: sort_order });
  if (error) throw error;
  await loadFamilies();
}

export async function deleteFamily(key) {
  if (key === 'global') throw new Error('La famille Global ne peut pas être supprimée.');
  const supabase = await getSupabaseClient();
  const { error } = await supabase.rpc('delete_void_family', { p_key: key });
  if (error) throw error;
  await loadFamilies();
}

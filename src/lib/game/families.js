import { setFamilyRegistry } from '@/lib/game/families-registry';

export { getFamRegistry as getFamilies, getFamOrder as getFamilyOrder, getFam as getFamily } from '@/lib/game/families-registry';

export async function loadFamilies() {
  try {
    const res = await fetch('/api/families');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data?.length) return;
    const familiesMap = {};
    const order = [];
    for (const row of data) {
      familiesMap[row.key] = Object.freeze({ key: row.key, label: row.label });
      order.push(row.key);
    }
    setFamilyRegistry(familiesMap, order);
    console.info('[VOID Pack] Familles chargées :', Object.keys(familiesMap).length);
  } catch (e) {
    console.warn('[VOID Pack] Familles fallback :', e?.message);
  }
}

export async function upsertFamily({ key, label }) {
  const res = await fetch('/api/families', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, label }),
  });
  if (!res.ok) throw new Error(await res.text());
  await loadFamilies();
}

export async function deleteFamily(key) {
  if (key === 'global') throw new Error('La famille Global ne peut pas être supprimée.');
  const res = await fetch('/api/families', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(await res.text());
  await loadFamilies();
}

/**
 * families-registry.js — SOURCE DE VÉRITÉ UNIQUE pour les familles VOID.
 * Chargé depuis Supabase au boot via families.js → setFamilyRegistry().
 */

const GLOBAL_FAMILY = Object.freeze({ key: 'global', label: 'Global', color: '#a78bfa', description: '' });

let _registry = { global: GLOBAL_FAMILY };
let _order    = ['global'];

export function getFam(key) {
  return _registry[key] ?? { key, label: key, color: '#a78bfa', description: '' };
}
export function getFamOrder()    { return _order; }
export function getFamRegistry() { return _registry; }
export function isFamKnown(key)  { return key in _registry; }

export function setFamilyRegistry(families, order) {
  _registry = { ...families };
  _order    = [...order];
  if (typeof window !== 'undefined') {
    window.__VOID_FAMILIES__     = _registry;
    window.__VOID_FAMILY_ORDER__ = _order;
  }
}

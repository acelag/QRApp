// Page-level permission keys that an admin can grant to staff users
// (manager / cashier / waiter / kitchen). admin & super_admin implicitly
// have every permission. Feature-gated permissions are only assignable when
// the restaurant has the matching feature enabled (see lib/features.ts).

import type { FeatureKey } from './features';

export const ALL_PERMISSIONS = [
  'orders', 'newOrder', 'tableStatus',
  'menu', 'combos', 'menuSchedules',
  'locations',
  'kitchenDisplay', 'readyDisplay',
  'bills', 'roomCharges', 'promoCodes',
  'reports', 'shiftReport', 'stockReport',
  'stock',
  'waiters', 'staffPerformance', 'roster',
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number];

// Permissions that are gated behind a restaurant feature flag.
export const PERMISSION_FEATURE: Partial<Record<PermissionKey, FeatureKey>> = {
  tableStatus:      'tableStatus',
  combos:           'combos',
  menuSchedules:    'menuSchedules',
  kitchenDisplay:   'kitchenDisplay',
  readyDisplay:     'readyDisplay',
  bills:            'bills',
  roomCharges:      'roomCharges',
  promoCodes:       'promoCodes',
  reports:          'reports',
  shiftReport:      'shiftReport',
  staffPerformance: 'staffPerformance',
  roster:           'roster',
};

export function parsePermissions(raw: unknown): PermissionKey[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(ALL_PERMISSIONS as readonly string[]);
  return raw.filter((p): p is PermissionKey => typeof p === 'string' && set.has(p));
}

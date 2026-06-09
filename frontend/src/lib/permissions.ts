import type { RestaurantFeatures } from '../context/AuthContext';

// Page-level permissions an admin can grant to staff (manager/cashier/waiter/kitchen).
// admin & super_admin implicitly have all permissions. A permission whose
// `feature` is disabled for the restaurant is not assignable (super-admin owns that gate).

export type PermissionKey =
  | 'orders' | 'newOrder' | 'tableStatus'
  | 'menu' | 'combos' | 'menuSchedules'
  | 'locations'
  | 'kitchenDisplay' | 'readyDisplay'
  | 'bills' | 'roomCharges' | 'promoCodes'
  | 'reports' | 'shiftReport' | 'stockReport'
  | 'stock'
  | 'waiters' | 'staffPerformance' | 'roster';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  feature?: keyof RestaurantFeatures; // gated by restaurant feature flag
}

export interface PermissionGroup {
  group: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Orders & Service',
    items: [
      { key: 'orders',      label: 'Live Orders' },
      { key: 'newOrder',    label: 'New Order' },
      { key: 'tableStatus', label: 'Table Status', feature: 'tableStatus' },
    ],
  },
  {
    group: 'Menu',
    items: [
      { key: 'menu',          label: 'Menu Items' },
      { key: 'combos',        label: 'Combo Deals',    feature: 'combos' },
      { key: 'menuSchedules', label: 'Menu Schedules', feature: 'menuSchedules' },
    ],
  },
  {
    group: 'Floor',
    items: [
      { key: 'locations', label: 'Tables & Rooms' },
    ],
  },
  {
    group: 'Displays',
    items: [
      { key: 'kitchenDisplay', label: 'Kitchen Display', feature: 'kitchenDisplay' },
      { key: 'readyDisplay',   label: 'Ready Display',   feature: 'readyDisplay' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'bills',       label: 'Bills',       feature: 'bills' },
      { key: 'roomCharges', label: 'Room Charges', feature: 'roomCharges' },
      { key: 'promoCodes',  label: 'Promo Codes',  feature: 'promoCodes' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { key: 'reports',     label: 'Order Reports', feature: 'reports' },
      { key: 'shiftReport', label: 'Shift Report',  feature: 'shiftReport' },
      { key: 'stockReport', label: 'Stock Report' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { key: 'stock', label: 'Stock' },
    ],
  },
  {
    group: 'Staff',
    items: [
      { key: 'waiters',          label: 'Waiters' },
      { key: 'staffPerformance', label: 'Staff Performance', feature: 'staffPerformance' },
      { key: 'roster',           label: 'Roster',            feature: 'roster' },
    ],
  },
];

export const ALL_PERMISSION_DEFS: PermissionDef[] = PERMISSION_GROUPS.flatMap((g) => g.items);

/** Permissions assignable for a restaurant = all whose feature (if any) is enabled. */
export function assignablePermissions(features: RestaurantFeatures): PermissionDef[] {
  return ALL_PERMISSION_DEFS.filter((p) => !p.feature || features[p.feature] !== false);
}

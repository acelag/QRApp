// Shared feature-flag definitions. Plans (lib/plans.ts) map onto these,
// and each restaurant stores its enabled set in the `features` JSONB column.

// All feature keys that can be toggled per restaurant
export const ALL_FEATURES = [
  'combos', 'menuSchedules', 'roomCharges', 'promoCodes',
  'reports', 'roster', 'shiftReport', 'staffPerformance',
  'tableStatus', 'readyDisplay', 'kitchenDisplay', 'bills',
] as const;

export type FeatureKey = typeof ALL_FEATURES[number];
export type RestaurantFeatures = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES: RestaurantFeatures = {
  combos: true, menuSchedules: true, roomCharges: true, promoCodes: true,
  reports: true, roster: true, shiftReport: true, staffPerformance: true,
  tableStatus: true, readyDisplay: true, kitchenDisplay: true, bills: true,
};

export function parseFeatures(raw: unknown): RestaurantFeatures {
  const stored = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<RestaurantFeatures>;
  const out = { ...DEFAULT_FEATURES };
  for (const k of ALL_FEATURES) {
    if (typeof stored[k] === 'boolean') out[k] = stored[k] as boolean;
  }
  return out;
}

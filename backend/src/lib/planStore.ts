import { pool } from '../db/database';
import { ALL_FEATURES, type FeatureKey, type RestaurantFeatures } from './features';
import { DEFAULT_PLANS, PLAN_CODES, type Plan, type PlanCode } from './plans';

// In-memory cache of editable plan data, refreshed at startup and after edits,
// so featuresForPlan()/getPlans() stay synchronous for existing call sites.
let cache = new Map<PlanCode, Plan>();

function rowToPlan(row: Record<string, unknown>): Plan {
  const feats = Array.isArray(row.features) ? (row.features as string[]) : [];
  const highs = Array.isArray(row.highlights) ? (row.highlights as string[]) : [];
  return {
    code: row.code as PlanCode,
    name: (row.name as string) ?? '',
    priceLkr: Number(row.price_lkr ?? 0),
    priceUsd: Number(row.price_usd ?? 0),
    tagline: (row.tagline as string) ?? '',
    features: feats.filter((f): f is FeatureKey => (ALL_FEATURES as readonly string[]).includes(f)),
    highlights: highs,
    sortOrder: Number(row.sort_order ?? 0),
    visible: row.visible !== false,
  };
}

/** Insert default plans on first run (no-op if any already exist). */
export async function seedPlansIfEmpty(): Promise<void> {
  const existing = await pool.query('SELECT COUNT(*)::int AS n FROM plans');
  if ((existing.rows[0] as { n: number }).n > 0) return;
  for (const p of DEFAULT_PLANS) {
    await pool.query(
      `INSERT INTO plans (code, name, tagline, price_lkr, price_usd, features, highlights, sort_order, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO NOTHING`,
      [p.code, p.name, p.tagline, p.priceLkr, p.priceUsd, JSON.stringify(p.features), JSON.stringify(p.highlights), p.sortOrder, p.visible],
    );
  }
}

/** Reload the in-memory cache from the DB. Falls back to defaults on error. */
export async function reloadPlans(): Promise<void> {
  try {
    const res = await pool.query('SELECT * FROM plans');
    const next = new Map<PlanCode, Plan>();
    for (const row of res.rows as Record<string, unknown>[]) {
      const p = rowToPlan(row);
      if ((PLAN_CODES as string[]).includes(p.code)) next.set(p.code, p);
    }
    // Ensure all fixed codes exist (fall back to defaults for any missing).
    for (const d of DEFAULT_PLANS) if (!next.has(d.code)) next.set(d.code, d);
    cache = next;
  } catch {
    cache = new Map(DEFAULT_PLANS.map((p) => [p.code, p]));
  }
}

/** All plans, in display order (includes hidden ones). */
export function getAllPlans(): Plan[] {
  const list = cache.size ? [...cache.values()] : [...DEFAULT_PLANS];
  return list.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Publicly visible plans only (for the marketing/pricing page). */
export function getVisiblePlans(): Plan[] {
  return getAllPlans().filter((p) => p.visible);
}

export function getPlan(code: PlanCode): Plan | undefined {
  return cache.get(code) ?? DEFAULT_PLANS.find((p) => p.code === code);
}

/** Build the full RestaurantFeatures record for a plan from its current config. */
export function featuresForPlan(code: PlanCode): RestaurantFeatures {
  const plan = getPlan(code);
  const enabled = new Set(plan?.features ?? []);
  const out = {} as RestaurantFeatures;
  for (const k of ALL_FEATURES) out[k] = enabled.has(k);
  return out;
}

/** Update one plan's editable fields, then refresh the cache. */
export async function updatePlan(code: PlanCode, patch: Partial<Plan>): Promise<Plan | null> {
  const cur = getPlan(code);
  if (!cur) return null;
  const next: Plan = {
    ...cur,
    name: patch.name?.trim() || cur.name,
    tagline: patch.tagline ?? cur.tagline,
    priceLkr: patch.priceLkr != null ? Math.max(0, Math.round(patch.priceLkr)) : cur.priceLkr,
    priceUsd: patch.priceUsd != null ? Math.max(0, Math.round(patch.priceUsd)) : cur.priceUsd,
    features: Array.isArray(patch.features)
      ? patch.features.filter((f): f is FeatureKey => (ALL_FEATURES as readonly string[]).includes(f))
      : cur.features,
    highlights: Array.isArray(patch.highlights) ? patch.highlights.map((h) => String(h)).filter(Boolean) : cur.highlights,
    visible: typeof patch.visible === 'boolean' ? patch.visible : cur.visible,
  };
  await pool.query(
    `UPDATE plans SET name=$1, tagline=$2, price_lkr=$3, price_usd=$4, features=$5, highlights=$6, visible=$7 WHERE code=$8`,
    [next.name, next.tagline, next.priceLkr, next.priceUsd, JSON.stringify(next.features), JSON.stringify(next.highlights), next.visible, code],
  );
  await reloadPlans();
  return getPlan(code) ?? next;
}

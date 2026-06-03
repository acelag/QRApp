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
    priceLkrYear: Number(row.price_lkr_year ?? 0),
    priceUsdYear: Number(row.price_usd_year ?? 0),
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
      `INSERT INTO plans (code, name, tagline, price_lkr, price_usd, price_lkr_year, price_usd_year, features, highlights, sort_order, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (code) DO NOTHING`,
      [p.code, p.name, p.tagline, p.priceLkr, p.priceUsd, p.priceLkrYear, p.priceUsdYear, JSON.stringify(p.features), JSON.stringify(p.highlights), p.sortOrder, p.visible],
    );
  }
}

/**
 * One-time backfill of annual prices for plans seeded before annual billing
 * existed. Only runs when NO plan has any annual price yet, so it never
 * clobbers a super-admin who intentionally set annual prices (incl. 0).
 * Default annual = 10× monthly (≈ 2 months free).
 */
export async function ensureAnnualPrices(): Promise<void> {
  try {
    const sum = await pool.query('SELECT COALESCE(SUM(price_lkr_year + price_usd_year),0)::int AS s FROM plans');
    if ((sum.rows[0] as { s: number }).s > 0) return;
    await pool.query('UPDATE plans SET price_usd_year = price_usd * 10, price_lkr_year = price_lkr * 10 WHERE price_usd > 0 OR price_lkr > 0');
  } catch { /* non-fatal */ }
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
    priceLkrYear: patch.priceLkrYear != null ? Math.max(0, Math.round(patch.priceLkrYear)) : cur.priceLkrYear,
    priceUsdYear: patch.priceUsdYear != null ? Math.max(0, Math.round(patch.priceUsdYear)) : cur.priceUsdYear,
    features: Array.isArray(patch.features)
      ? patch.features.filter((f): f is FeatureKey => (ALL_FEATURES as readonly string[]).includes(f))
      : cur.features,
    highlights: Array.isArray(patch.highlights) ? patch.highlights.map((h) => String(h)).filter(Boolean) : cur.highlights,
    visible: typeof patch.visible === 'boolean' ? patch.visible : cur.visible,
  };
  await pool.query(
    `UPDATE plans SET name=$1, tagline=$2, price_lkr=$3, price_usd=$4, price_lkr_year=$5, price_usd_year=$6, features=$7, highlights=$8, visible=$9 WHERE code=$10`,
    [next.name, next.tagline, next.priceLkr, next.priceUsd, next.priceLkrYear, next.priceUsdYear, JSON.stringify(next.features), JSON.stringify(next.highlights), next.visible, code],
  );
  await reloadPlans();
  return getPlan(code) ?? next;
}

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

// Feature-flag definitions live in lib/features.ts (shared with the
// subscription/plan logic). Re-export so existing references keep working.
import { ALL_FEATURES, parseFeatures } from '../lib/features';
export { ALL_FEATURES };
export type { FeatureKey, RestaurantFeatures } from '../lib/features';

const toRestaurant = (row: Record<string, unknown>) => ({
  id: row.id, name: row.name, slug: row.slug, active: row.active === true, createdAt: row.created_at,
  serviceChargePct: Number(row.service_charge_pct ?? 0), taxPct: Number(row.tax_pct ?? 0),
  serviceChargeName: (row.service_charge_name as string | null) ?? 'Service Charge',
  taxName:           (row.tax_name           as string | null) ?? 'Tax',
  currency: (row.currency as string | null) ?? 'USD',
  logo: (row.logo as string | null) ?? null,
  themeColor: (row.theme_color as string | null) ?? '#f97316',
  orderNumberPrefix: (row.order_number_prefix as string | null) ?? 'ORD',
  waitTimeMin: row.wait_time_min != null ? Number(row.wait_time_min) : null,
  timezone: (row.timezone as string | null) ?? 'UTC',
  roomServiceOpen:  (row.room_service_open  as string | null) ?? null,
  roomServiceClose: (row.room_service_close as string | null) ?? null,
  facebookUrl:     (row.facebook_url      as string | null) ?? null,
  instagramUrl:    (row.instagram_url     as string | null) ?? null,
  welcomeImageUrl: (row.welcome_image_url as string | null) ?? null,
  loginMedia:      Array.isArray(row.login_media) ? (row.login_media as string[]) : [],
  loginVideoUrl:   (row.login_video_url   as string | null) ?? null,
  tiktokUrl:       (row.tiktok_url        as string | null) ?? null,
  whatsappUrl:     (row.whatsapp_url      as string | null) ?? null,
  youtubeUrl:      (row.youtube_url       as string | null) ?? null,
  twitterUrl:      (row.twitter_url       as string | null) ?? null,
  welcomeHeading:  (row.welcome_heading   as string | null) ?? null,
  welcomeTagline:  (row.welcome_tagline   as string | null) ?? null,
  receiptPrinterIp:   (row.receipt_printer_ip   as string | null) ?? null,
  receiptPrinterPort: row.receipt_printer_port != null ? Number(row.receipt_printer_port) : 9100,
  kitchenPrinterIp:   (row.kitchen_printer_ip   as string | null) ?? null,
  kitchenPrinterPort: row.kitchen_printer_port != null ? Number(row.kitchen_printer_port) : 9100,
  printerType:        ((row.printer_type as string | null) ?? 'epson') as 'epson' | 'star',
  autoPrintKitchen:   row.auto_print_kitchen === true,
  autoPrintReceipt:   row.auto_print_receipt === true,
  receiptHeaderLine1:   (row.receipt_header_line1   as string | null) ?? '',
  receiptHeaderLine2:   (row.receipt_header_line2   as string | null) ?? '',
  receiptFooterLine1:   (row.receipt_footer_line1   as string | null) ?? 'Thank you for dining with us!',
  receiptFooterLine2:   (row.receipt_footer_line2   as string | null) ?? 'Please come again 🙏',
  receiptShowOrderNo:   row.receipt_show_order_no   !== false,
  receiptShowUnitPrice: row.receipt_show_unit_price !== false,
  features: parseFeatures(row.features),
  plan:               (row.plan as string | null) ?? 'pro',
  subscriptionStatus: (row.subscription_status as string | null) ?? 'active',
  trialEndsAt:        (row.trial_ends_at as string | null) ?? null,
  currentPeriodEnd:   (row.current_period_end as string | null) ?? null,
});

// ── Public endpoints — no auth required ──────────────────────────────────────
router.get('/:id/currency', async (req, res) => {
  const result = await pool.query('SELECT currency FROM restaurants WHERE id = $1', [req.params.id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ currency: (result.rows[0] as Record<string, unknown>).currency ?? 'USD' });
});


router.get('/:id/info', async (req, res) => {
  const result = await pool.query(
    `SELECT name, logo, theme_color, wait_time_min, room_service_open, room_service_close,
            facebook_url, instagram_url, welcome_image_url, tiktok_url, whatsapp_url,
            youtube_url, twitter_url, welcome_heading, welcome_tagline,
            service_charge_pct, tax_pct, service_charge_name, tax_name
     FROM restaurants WHERE id = $1`,
    [req.params.id],
  );
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = result.rows[0] as Record<string, unknown>;
  res.json({
    name: row.name,
    logo: row.logo ?? null,
    themeColor: (row.theme_color as string | null) ?? '#f97316',
    waitTimeMin: row.wait_time_min != null ? Number(row.wait_time_min) : null,
    roomServiceOpen:  (row.room_service_open  as string | null) ?? null,
    roomServiceClose: (row.room_service_close as string | null) ?? null,
    facebookUrl:     (row.facebook_url      as string | null) ?? null,
    instagramUrl:    (row.instagram_url     as string | null) ?? null,
    welcomeImageUrl: (row.welcome_image_url as string | null) ?? null,
    tiktokUrl:       (row.tiktok_url        as string | null) ?? null,
    whatsappUrl:     (row.whatsapp_url      as string | null) ?? null,
    youtubeUrl:      (row.youtube_url       as string | null) ?? null,
    twitterUrl:      (row.twitter_url       as string | null) ?? null,
    welcomeHeading:  (row.welcome_heading   as string | null) ?? null,
    welcomeTagline:  (row.welcome_tagline   as string | null) ?? null,
    serviceChargePct:  Number(row.service_charge_pct ?? 0),
    taxPct:            Number(row.tax_pct ?? 0),
    serviceChargeName: (row.service_charge_name as string | null) ?? 'Service Charge',
    taxName:           (row.tax_name           as string | null) ?? 'Tax',
  });
});

// Public branded-login info by slug (no auth — used by /login/:slug)
router.get('/by-slug/:slug/branding', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, slug, logo, theme_color, login_media, login_video_url FROM restaurants WHERE slug = $1',
    [req.params.slug],
  );
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const row = result.rows[0] as Record<string, unknown>;
  res.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: (row.logo as string | null) ?? null,
    themeColor: (row.theme_color as string | null) ?? '#f97316',
    loginMedia: Array.isArray(row.login_media) ? (row.login_media as string[]) : [],
    loginVideoUrl: (row.login_video_url as string | null) ?? null,
  });
});

// ── Authenticated routes ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res) => {
  if (req.user!.role === 'super_admin') {
    const result = await pool.query('SELECT * FROM restaurants ORDER BY name');
    res.json((result.rows as Record<string, unknown>[]).map(toRestaurant));
  } else {
    if (!req.user!.restaurantId) { res.json([]); return; }
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.user!.restaurantId]);
    res.json((result.rows as Record<string, unknown>[]).map(toRestaurant));
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!result.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(result.rows[0] as Record<string, unknown>));
});

router.get('/:id/users', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT id, username, name, role FROM users WHERE restaurant_id = $1 ORDER BY role, username', [req.params.id]);
  res.json(result.rows.map((u: Record<string, unknown>) => ({ id: u.id, username: u.username, name: u.name, role: u.role })));
});

router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  const { name, adminUsername, adminPassword, adminName } = req.body as { name: string; adminUsername: string; adminPassword: string; adminName?: string; };
  if (!name?.trim() || !adminUsername?.trim() || !adminPassword) { res.status(400).json({ error: 'name, adminUsername and adminPassword are required' }); return; }
  const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug; let suffix = 2;
  while (true) {
    const taken = await pool.query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
    if (!taken.rows.length) break;
    slug = `${baseSlug}-${suffix++}`;
  }
  const restaurantId = uuid(); const now = new Date().toISOString();
  await pool.query('INSERT INTO restaurants (id,name,slug,active,created_at) VALUES ($1,$2,$3,TRUE,$4)', [restaurantId, name.trim(), slug, now]);
  const hash = await bcrypt.hash(adminPassword, 10);
  await pool.query(`INSERT INTO users (id,restaurant_id,username,password_hash,name,role) VALUES ($1,$2,$3,$4,$5,'admin')`,
    [uuid(), restaurantId, adminUsername.trim(), hash, adminName?.trim() || adminUsername.trim()]);
  res.status(201).json({ id: restaurantId, name: name.trim(), slug, active: true, createdAt: now });
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const result = await pool.query('UPDATE restaurants SET name = $1 WHERE id = $2', [name.trim(), id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/charges', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { serviceChargePct, taxPct, currency, serviceChargeName, taxName } =
    req.body as { serviceChargePct?: number; taxPct?: number; currency?: string; serviceChargeName?: string; taxName?: string };
  const toNum = (v: unknown) => { const n = Number(v); return (isNaN(n) || n < 0 || n > 100) ? null : Math.round(n * 100) / 100; };
  const sc = toNum(serviceChargePct); const tax = toNum(taxPct);
  if (sc === null || tax === null) { res.status(400).json({ error: 'Values must be numbers between 0 and 100' }); return; }
  const safeCurrency = typeof currency === 'string' && currency.trim().length > 0 ? currency.trim().toUpperCase() : null;
  const safeScName  = typeof serviceChargeName === 'string' && serviceChargeName.trim() ? serviceChargeName.trim().slice(0, 30) : null;
  const safeTaxName = typeof taxName           === 'string' && taxName.trim()           ? taxName.trim().slice(0, 30)           : null;
  await pool.query(
    `UPDATE restaurants
     SET service_charge_pct = $1, tax_pct = $2,
         currency            = COALESCE($3, currency),
         service_charge_name = COALESCE($4, service_charge_name),
         tax_name            = COALESCE($5, tax_name)
     WHERE id = $6`,
    [sc, tax, safeCurrency, safeScName, safeTaxName, id],
  );
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!updated.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/theme', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { themeColor } = req.body as { themeColor: string };
  if (!themeColor || !/^#[0-9a-fA-F]{6}$/.test(themeColor)) { res.status(400).json({ error: 'Invalid color' }); return; }
  await pool.query('UPDATE restaurants SET theme_color = $1 WHERE id = $2', [themeColor, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/logo', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { logo } = req.body as { logo: string | null };
  await pool.query('UPDATE restaurants SET logo = $1 WHERE id = $2', [logo ?? null, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!updated.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/login-branding', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { loginMedia, loginVideoUrl } = req.body as { loginMedia?: unknown; loginVideoUrl?: string | null };
  const media = Array.isArray(loginMedia)
    ? loginMedia.filter((m): m is string => typeof m === 'string').slice(0, 10)
    : [];
  await pool.query(
    'UPDATE restaurants SET login_media = $1, login_video_url = $2 WHERE id = $3',
    [JSON.stringify(media), (loginVideoUrl as string | null)?.trim() || null, id],
  );
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  if (!updated.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/order-prefix', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { orderNumberPrefix } = req.body as { orderNumberPrefix: string };
  const prefix = (orderNumberPrefix ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!prefix) { res.status(400).json({ error: 'Prefix must be 1–10 alphanumeric characters' }); return; }
  await pool.query('UPDATE restaurants SET order_number_prefix = $1 WHERE id = $2', [prefix, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/wait-time', authenticate, requireRole('admin', 'manager', 'kitchen'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { waitTimeMin } = req.body as { waitTimeMin: number | null };
  const safe = waitTimeMin == null ? null : Math.max(1, Math.min(180, Math.round(Number(waitTimeMin))));
  await pool.query('UPDATE restaurants SET wait_time_min = $1 WHERE id = $2', [safe, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/timezone', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { timezone } = req.body as { timezone?: string };
  // Validate against the runtime's IANA zone list.
  let valid = false;
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); valid = !!timezone; } catch { valid = false; }
  if (!valid) { res.status(400).json({ error: 'Invalid timezone' }); return; }
  await pool.query('UPDATE restaurants SET timezone = $1 WHERE id = $2', [timezone, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/room-service-hours', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { roomServiceOpen, roomServiceClose } = req.body as { roomServiceOpen?: string | null; roomServiceClose?: string | null };
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const open  = typeof roomServiceOpen  === 'string' && timeRe.test(roomServiceOpen)  ? roomServiceOpen  : null;
  const close = typeof roomServiceClose === 'string' && timeRe.test(roomServiceClose) ? roomServiceClose : null;
  await pool.query('UPDATE restaurants SET room_service_open = $1, room_service_close = $2 WHERE id = $3', [open, close, id]);
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/social', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const {
    facebookUrl, instagramUrl, welcomeImageUrl,
    tiktokUrl, whatsappUrl, youtubeUrl, twitterUrl,
    welcomeHeading, welcomeTagline,
  } = req.body as {
    facebookUrl?: string | null; instagramUrl?: string | null; welcomeImageUrl?: string | null;
    tiktokUrl?: string | null; whatsappUrl?: string | null; youtubeUrl?: string | null; twitterUrl?: string | null;
    welcomeHeading?: string | null; welcomeTagline?: string | null;
  };
  const clip = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  await pool.query(
    `UPDATE restaurants SET
       facebook_url = $1, instagram_url = $2, welcome_image_url = $3,
       tiktok_url = $4, whatsapp_url = $5, youtube_url = $6, twitter_url = $7,
       welcome_heading = $8, welcome_tagline = $9
     WHERE id = $10`,
    [
      clip(facebookUrl, 500), clip(instagramUrl, 500), clip(welcomeImageUrl, 500),
      clip(tiktokUrl, 500), clip(whatsappUrl, 500), clip(youtubeUrl, 500), clip(twitterUrl, 500),
      clip(welcomeHeading, 120), clip(welcomeTagline, 200),
      id,
    ],
  );
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/printer', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const { receiptPrinterIp, receiptPrinterPort, kitchenPrinterIp, kitchenPrinterPort, printerType, autoPrintKitchen, autoPrintReceipt } =
    req.body as { receiptPrinterIp?: string | null; receiptPrinterPort?: number; kitchenPrinterIp?: string | null; kitchenPrinterPort?: number; printerType?: string; autoPrintKitchen?: boolean; autoPrintReceipt?: boolean };
  const safeIp   = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  const safePort = (v: unknown) => { const n = Number(v); return (!isNaN(n) && n >= 1 && n <= 65535) ? n : 9100; };
  const safeType = ['epson', 'star'].includes(printerType ?? '') ? printerType : 'epson';
  await pool.query(
    `UPDATE restaurants SET
       receipt_printer_ip = $1, receipt_printer_port = $2,
       kitchen_printer_ip = $3, kitchen_printer_port = $4,
       printer_type = $5, auto_print_kitchen = $6, auto_print_receipt = $7
     WHERE id = $8`,
    [safeIp(receiptPrinterIp), safePort(receiptPrinterPort), safeIp(kitchenPrinterIp), safePort(kitchenPrinterPort), safeType, autoPrintKitchen === true, autoPrintReceipt === true, id],
  );
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/receipt-config', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user!.role !== 'super_admin' && req.user!.restaurantId !== id) { res.status(403).json({ error: 'Access denied' }); return; }
  const {
    receiptHeaderLine1, receiptHeaderLine2,
    receiptFooterLine1, receiptFooterLine2,
    receiptShowOrderNo, receiptShowUnitPrice,
  } = req.body as {
    receiptHeaderLine1?: string; receiptHeaderLine2?: string;
    receiptFooterLine1?: string; receiptFooterLine2?: string;
    receiptShowOrderNo?: boolean; receiptShowUnitPrice?: boolean;
  };
  const cap = (s: unknown, def = '') => (typeof s === 'string' ? s.slice(0, 100) : def);
  await pool.query(
    `UPDATE restaurants SET
       receipt_header_line1    = $1,
       receipt_header_line2    = $2,
       receipt_footer_line1    = $3,
       receipt_footer_line2    = $4,
       receipt_show_order_no   = $5,
       receipt_show_unit_price = $6
     WHERE id = $7`,
    [
      cap(receiptHeaderLine1),
      cap(receiptHeaderLine2),
      cap(receiptFooterLine1, 'Thank you for dining with us!'),
      cap(receiptFooterLine2, 'Please come again 🙏'),
      receiptShowOrderNo !== false,
      receiptShowUnitPrice !== false,
      id,
    ],
  );
  const updated = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  res.json(toRestaurant(updated.rows[0] as Record<string, unknown>));
});

router.patch('/:id/features', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const incoming = req.body as Partial<Record<string, boolean>>;
  // Load existing features then merge
  const existing = await pool.query('SELECT features FROM restaurants WHERE id = $1', [id]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const current = parseFeatures((existing.rows[0] as Record<string, unknown>).features);
  for (const k of ALL_FEATURES) {
    if (typeof incoming[k] === 'boolean') current[k] = incoming[k] as boolean;
  }
  await pool.query('UPDATE restaurants SET features = $1 WHERE id = $2', [JSON.stringify(current), id]);
  res.json({ features: current });
});

router.patch('/:id/active', authenticate, requireRole('super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params; const { active } = req.body as { active: boolean };
  if (typeof active !== 'boolean') { res.status(400).json({ error: 'active (boolean) is required' }); return; }
  const result = await pool.query('UPDATE restaurants SET active = $1 WHERE id = $2', [active, id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ id, active });
});

router.post('/impersonate/:userId', authenticate, requireRole('super_admin'), async (_req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [_req.params.userId]);
  if (!result.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
  const user = result.rows[0] as Record<string, unknown>;
  const payload = { id: user.id, username: user.username, name: user.name, role: user.role, restaurantId: user.restaurant_id ?? null };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

export default router;

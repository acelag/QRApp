import 'dotenv/config'; // must be first — loads .env before anything else reads process.env

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { connectDb } from './db/database';
import { createSchema } from './db/schema';
import { seedIfEmpty } from './db/seed';
import { authenticate, requireRole } from './middleware/auth';
import authRouter from './routes/auth';
import categoriesRouter from './routes/categories';
import menuItemsRouter from './routes/menuItems';
import ordersRouter from './routes/orders';
import tablesRouter from './routes/tables';
import uploadRouter from './routes/upload';
import usersRouter from './routes/users';
import sessionsRouter from './routes/sessions';
import restaurantsRouter from './routes/restaurants';
import pushRouter from './routes/push';
import reportsRouter from './routes/reports';
import roomsRouter from './routes/rooms';
import promoCodesRouter from './routes/promoCodes';
import customerPushRouter from './routes/customerPush';
import waitersRouter from './routes/waiters';
import tagsRouter from './routes/tags';
import refundsRouter from './routes/refunds';
import printRouter from './routes/print';
import rosterRouter from './routes/roster';
import menuSchedulesRouter from './routes/menuSchedules';
import combosRouter from './routes/combos';
import reservationsRouter from './routes/reservations';
import subscriptionRouter from './routes/subscription';
import stockRouter from './routes/stock';
import loyaltyRouter from './routes/loyalty';
import auditLogsRouter from './routes/auditLogs';
import simBotRouter from './routes/simBot';
import './lib/vapid'; // initialise VAPID keys at startup
import { startStaleOrderChecker } from './lib/staleOrderChecker';
import { startSubscriptionChecker } from './lib/subscriptionChecker';
import { seedPlansIfEmpty, ensureAnnualPrices, reloadPlans } from './lib/planStore';
import { loadAppSettings } from './lib/appSettings';

const app  = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Capacitor native apps send these as their Origin header
const NATIVE_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

// In dev, also allow any private-network origin (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
// so phones/tablets on the same LAN can reach the dev server.
const LOCAL_NET = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (NATIVE_ORIGINS.includes(origin)) return cb(null, true);
    if (!isProd && LOCAL_NET.test(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ── Rate limiting ────────────────────────────────────────────────────────────
// Auth endpoints: 20 attempts per 15 min window
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes.' },
});

// General API: 300 req / min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/categories',  categoriesRouter);
app.use('/api/menu-items',  menuItemsRouter);
app.use('/api/tables',      tablesRouter);
app.use('/api/orders',      ordersRouter);
app.use('/api/sessions',    sessionsRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/push',        pushRouter);
app.use('/api/reports',     reportsRouter);
app.use('/api/rooms',        roomsRouter);
app.use('/api/promo-codes',  promoCodesRouter);
app.use('/api/customer-push', customerPushRouter);
app.use('/api/waiters',       waitersRouter);
app.use('/api/tags',          tagsRouter);
app.use('/api/refunds',      refundsRouter);
app.use('/api/print',        printRouter);
app.use('/api/roster',          rosterRouter);
app.use('/api/menu-schedules',  menuSchedulesRouter);
app.use('/api/combos',          combosRouter);
app.use('/api/reservations',    reservationsRouter);
app.use('/api/subscription',    subscriptionRouter);
app.use('/api/stock',           stockRouter);
app.use('/api/loyalty',         loyaltyRouter);
app.use('/api/audit-logs',      auditLogsRouter);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev/sim-bot', simBotRouter);
}
app.use('/api/upload',      authenticate, requireRole('admin'), uploadRouter);
app.use('/api/users',       usersRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Always log full error server-side
  console.error(err);

  // In production, never leak internal details to the client
  if (isProd) {
    res.status(500).json({ error: 'An unexpected error occurred.' });
  } else {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

// ── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDb();
    await createSchema();
    await seedIfEmpty();
    await seedPlansIfEmpty();
    await ensureAnnualPrices();
    await reloadPlans();
    await loadAppSettings();
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`);
      startStaleOrderChecker();
      startSubscriptionChecker();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

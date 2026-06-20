import { Pool } from 'pg';

const isRemote = (process.env.DATABASE_URL ?? '').includes('.render.com') || (process.env.DATABASE_URL ?? '').includes('.neon.tech');
// Set SSL_REJECT_UNAUTHORIZED=true in production once your CA cert is confirmed.
const rejectUnauthorized = process.env.SSL_REJECT_UNAUTHORIZED === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// A transient drop on an idle pooled connection (common with remote/managed
// Postgres) emits an 'error' event. Without a listener, Node throws and the
// whole process crashes. Log and swallow it — the pool recovers on the next query.
pool.on('error', (err) => {
  console.error('[pg pool] idle client error (recovering):', err.message);
});

export async function connectDb(): Promise<void> {
  await pool.query('SELECT 1');
  console.log('✓ Connected to PostgreSQL');
}

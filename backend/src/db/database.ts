import { Pool } from 'pg';

const isRemote = (process.env.DATABASE_URL ?? '').includes('.render.com') || (process.env.DATABASE_URL ?? '').includes('.neon.tech');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
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

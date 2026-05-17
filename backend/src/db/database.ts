import { Pool } from 'pg';

const isRemote = (process.env.DATABASE_URL ?? '').includes('.render.com');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

export async function connectDb(): Promise<void> {
  await pool.query('SELECT 1');
  console.log('✓ Connected to PostgreSQL');
}

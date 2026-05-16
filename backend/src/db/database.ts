import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function connectDb(): Promise<void> {
  await pool.query('SELECT 1');
  console.log('✓ Connected to PostgreSQL');
}

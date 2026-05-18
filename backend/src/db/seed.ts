import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool } from './database';

export async function seedIfEmpty(): Promise<void> {
  const rCheck = await pool.query('SELECT id FROM restaurants LIMIT 1');
  let restaurantId: string;

  if (rCheck.rows.length === 0) {
    restaurantId = uuid();
    await pool.query(
      `INSERT INTO restaurants (id, name, slug, active, created_at) VALUES ($1, $2, $3, TRUE, $4)`,
      [restaurantId, 'The Restaurant', 'the-restaurant', new Date().toISOString()],
    );
    console.log(`✓ Default restaurant created  →  id: ${restaurantId}`);
  } else {
    restaurantId = rCheck.rows[0].id as string;
  }

  await pool.query('UPDATE categories     SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);
  await pool.query('UPDATE menu_items     SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);
  await pool.query('UPDATE tables         SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);
  await pool.query('UPDATE table_sessions SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);
  await pool.query('UPDATE orders         SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);
  await pool.query("UPDATE users          SET restaurant_id = $1 WHERE restaurant_id IS NULL AND role != 'super_admin'", [restaurantId]);
  await pool.query('UPDATE push_subscriptions SET restaurant_id = $1 WHERE restaurant_id IS NULL', [restaurantId]);

  const userCount = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (parseInt(userCount.rows[0].n as string) === 0) await seedUsers(restaurantId);

  const saCheck = await pool.query("SELECT id FROM users WHERE role = 'super_admin'");
  if (saCheck.rows.length === 0) {
    const hash = await bcrypt.hash('super123', 10);
    await pool.query(
      `INSERT INTO users (id, restaurant_id, username, password_hash, name, role) VALUES ($1, NULL, $2, $3, $4, 'super_admin')`,
      [uuid(), 'superadmin', hash, 'Super Admin'],
    );
    console.log('✓ Super admin account created');
  }
}


async function seedUsers(restaurantId: string): Promise<void> {
  const add = async (username: string, password: string, name: string, role: string, rid: string | null) => {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (id, restaurant_id, username, password_hash, name, role) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), rid, username, hash, name, role],
    );
  };
  await add('admin',   'admin123',   'Restaurant Admin', 'admin',   restaurantId);
  await add('kitchen', 'kitchen123', 'Kitchen Staff',    'kitchen', restaurantId);
  console.log('✓ Default users seeded');
}

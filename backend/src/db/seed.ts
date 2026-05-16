import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool, sql } from './database';

export async function seedIfEmpty(): Promise<void> {
  // ── 1. Ensure a default restaurant exists ─────────────────────────────────
  const rCheck = await pool.request().query('SELECT TOP 1 id FROM restaurants');
  let restaurantId: string;

  if (rCheck.recordset.length === 0) {
    restaurantId = uuid();
    await pool.request()
      .input('id',   sql.NVarChar, restaurantId)
      .input('name', sql.NVarChar, 'The Restaurant')
      .input('slug', sql.NVarChar, 'the-restaurant')
      .input('now',  sql.NVarChar, new Date().toISOString())
      .query(`
        INSERT INTO restaurants (id, name, slug, created_at)
        VALUES (@id, @name, @slug, @now)
      `);
    console.log(`✓ Default restaurant created  →  id: ${restaurantId}`);
  } else {
    restaurantId = rCheck.recordset[0].id as string;
  }

  // ── 2. Migrate any rows that pre-date multi-tenancy (restaurant_id IS NULL) ─
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE categories     SET restaurant_id = @rid WHERE restaurant_id IS NULL');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE menu_items     SET restaurant_id = @rid WHERE restaurant_id IS NULL');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE tables         SET restaurant_id = @rid WHERE restaurant_id IS NULL');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE table_sessions SET restaurant_id = @rid WHERE restaurant_id IS NULL');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE orders         SET restaurant_id = @rid WHERE restaurant_id IS NULL');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE users          SET restaurant_id = @rid WHERE restaurant_id IS NULL AND role != \'super_admin\'');
  await pool.request()
    .input('rid', sql.NVarChar, restaurantId)
    .query('UPDATE push_subscriptions SET restaurant_id = @rid WHERE restaurant_id IS NULL');

  // ── 3. Seed menu, tables, and users if still empty ─────────────────────────
  const catCount = await pool.request().query('SELECT COUNT(*) AS n FROM categories');
  if (catCount.recordset[0].n === 0) {
    await seedMenu(restaurantId);
  }

  const userCount = await pool.request().query('SELECT COUNT(*) AS n FROM users');
  if (userCount.recordset[0].n === 0) {
    await seedUsers(restaurantId);
  }

  // ── 4. Always ensure a super_admin account exists ──────────────────────────
  const saCheck = await pool.request().query("SELECT id FROM users WHERE role = 'super_admin'");
  if (saCheck.recordset.length === 0) {
    const hash = await bcrypt.hash('super123', 10);
    await pool.request()
      .input('id',   sql.NVarChar, uuid())
      .input('user', sql.NVarChar, 'superadmin')
      .input('hash', sql.NVarChar, hash)
      .input('name', sql.NVarChar, 'Super Admin')
      .query(`
        INSERT INTO users (id, restaurant_id, username, password_hash, name, role)
        VALUES (@id, NULL, @user, @hash, @name, 'super_admin')
      `);
    console.log('✓ Super admin account created');
  }
}

async function seedMenu(restaurantId: string): Promise<void> {
  const addCategory = async (name: string): Promise<string> => {
    const id = uuid();
    await pool.request()
      .input('id',  sql.NVarChar, id)
      .input('rid', sql.NVarChar, restaurantId)
      .input('name',sql.NVarChar, name)
      .query('INSERT INTO categories (id, restaurant_id, name) VALUES (@id, @rid, @name)');
    return id;
  };

  const addItem = async (name: string, description: string, price: number, categoryId: string) => {
    await pool.request()
      .input('id',         sql.NVarChar,      uuid())
      .input('rid',        sql.NVarChar,      restaurantId)
      .input('name',       sql.NVarChar,      name)
      .input('desc',       sql.NVarChar,      description)
      .input('price',      sql.Decimal(10,2), price)
      .input('categoryId', sql.NVarChar,      categoryId)
      .query(`
        INSERT INTO menu_items (id, restaurant_id, name, description, price, category_id, available)
        VALUES (@id, @rid, @name, @desc, @price, @categoryId, 1)
      `);
  };

  const addTable = async (number: number, seats: number) => {
    await pool.request()
      .input('id',     sql.NVarChar, uuid())
      .input('rid',    sql.NVarChar, restaurantId)
      .input('number', sql.Int,      number)
      .input('seats',  sql.Int,      seats)
      .query('INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES (@id, @rid, @number, @seats, 1)');
  };

  const burgers  = await addCategory('Burgers');
  const drinks   = await addCategory('Drinks');
  const sides    = await addCategory('Sides');
  const desserts = await addCategory('Desserts');

  await addItem('Classic Burger',    'Beef patty, lettuce, tomato, pickles', 12.99, burgers);
  await addItem('Cheese Burger',     'Classic burger with melted cheddar',   13.99, burgers);
  await addItem('Veggie Burger',     'Plant-based patty with fresh veggies', 11.99, burgers);
  await addItem('BBQ Burger',        'Smoky BBQ sauce, caramelized onions',  14.99, burgers);
  await addItem('Coca Cola',         '330 ml can',                            2.99, drinks);
  await addItem('Lemonade',          'Fresh squeezed lemonade',               3.99, drinks);
  await addItem('Milkshake',         'Vanilla, chocolate, or strawberry',     5.99, drinks);
  await addItem('French Fries',      'Crispy golden fries',                   4.99, sides);
  await addItem('Onion Rings',       'Battered and fried onion rings',        5.49, sides);
  await addItem('Coleslaw',          'Creamy house coleslaw',                 3.49, sides);
  await addItem('Chocolate Brownie', 'Warm brownie with ice cream',           6.99, desserts);
  await addItem('Ice Cream',         'Two scoops, choice of flavor',          4.99, desserts);

  await addTable(1, 2);
  await addTable(2, 4);
  await addTable(3, 4);
  await addTable(4, 6);
  await addTable(5, 2);

  console.log('✓ Menu and tables seeded');
}

async function seedUsers(restaurantId: string): Promise<void> {
  const addUser = async (username: string, password: string, name: string, role: string, rid: string | null) => {
    const hash = await bcrypt.hash(password, 10);
    await pool.request()
      .input('id',   sql.NVarChar, uuid())
      .input('rid',  sql.NVarChar, rid)
      .input('user', sql.NVarChar, username)
      .input('hash', sql.NVarChar, hash)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, role)
      .query(`
        INSERT INTO users (id, restaurant_id, username, password_hash, name, role)
        VALUES (@id, @rid, @user, @hash, @name, @role)
      `);
  };

  await addUser('admin',   'admin123',   'Restaurant Admin', 'admin',   restaurantId);
  await addUser('kitchen', 'kitchen123', 'Kitchen Staff',    'kitchen', restaurantId);

  console.log('✓ Default users seeded');
}

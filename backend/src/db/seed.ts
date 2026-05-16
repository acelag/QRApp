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

  const catCount = await pool.query('SELECT COUNT(*) AS n FROM categories');
  if (parseInt(catCount.rows[0].n as string) === 0) await seedMenu(restaurantId);

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

async function seedMenu(restaurantId: string): Promise<void> {
  const addCat = async (name: string) => {
    const id = uuid();
    await pool.query('INSERT INTO categories (id, restaurant_id, name) VALUES ($1, $2, $3)', [id, restaurantId, name]);
    return id;
  };
  const addItem = async (name: string, desc: string, price: number, catId: string) => {
    await pool.query(
      `INSERT INTO menu_items (id, restaurant_id, name, description, price, category_id, available) VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
      [uuid(), restaurantId, name, desc, price, catId],
    );
  };
  const addTable = async (number: number, seats: number) => {
    await pool.query('INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES ($1,$2,$3,$4,TRUE)', [uuid(), restaurantId, number, seats]);
  };

  const burgers  = await addCat('Burgers');
  const drinks   = await addCat('Drinks');
  const sides    = await addCat('Sides');
  const desserts = await addCat('Desserts');

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

  await addTable(1, 2); await addTable(2, 4); await addTable(3, 4);
  await addTable(4, 6); await addTable(5, 2);

  console.log('✓ Menu and tables seeded');
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

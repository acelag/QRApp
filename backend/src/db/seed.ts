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

  interface ItemOpts {
    largePrice?: number;
    discountPct?: number;
    largeDiscountPct?: number;
  }
  const addItem = async (name: string, desc: string, price: number, catId: string, opts: ItemOpts = {}) => {
    await pool.query(
      `INSERT INTO menu_items
         (id, restaurant_id, name, description, price, large_price, discount_pct, large_discount_pct, category_id, available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)`,
      [
        uuid(), restaurantId, name, desc, price,
        opts.largePrice       ?? null,
        opts.discountPct      ?? 0,
        opts.largeDiscountPct ?? 0,
        catId,
      ],
    );
  };

  const addTable = async (number: number, seats: number) => {
    await pool.query('INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES ($1,$2,$3,$4,TRUE)', [uuid(), restaurantId, number, seats]);
  };

  const burgers  = await addCat('Burgers');
  const drinks   = await addCat('Drinks');
  const sides    = await addCat('Sides');
  const desserts = await addCat('Desserts');
  const pizza    = await addCat('Pizza');

  // Burgers — regular + large sizes, some discounted
  await addItem('Classic Burger',       'Beef patty, lettuce, tomato, pickles',        1299, burgers, { largePrice: 1699 });
  await addItem('Cheese Burger',        'Classic with melted cheddar cheese',           1499, burgers, { largePrice: 1899, discountPct: 10, largeDiscountPct: 10 });
  await addItem('BBQ Burger',           'Smoky BBQ sauce and caramelised onions',       1699, burgers, { largePrice: 2199 });
  await addItem('Veggie Burger',        'Plant-based patty with fresh garden veggies',  1399, burgers, { largePrice: 1799 });
  await addItem('Spicy Chicken Burger', 'Crispy chicken, jalapeños, sriracha mayo',     1599, burgers, { largePrice: 2099, discountPct: 5 });
  await addItem('Double Stack',         'Two beef patties, double cheese, special sauce', 1999, burgers, { largePrice: 2599 });
  await addItem('Mushroom Swiss',       'Beef patty, sautéed mushrooms, Swiss cheese',  1749, burgers);

  // Drinks
  await addItem('Coca Cola',            '330 ml chilled can',                           1000, drinks);
  await addItem('Lemonade',             'Fresh-squeezed lemonade with mint',            1200, drinks);
  await addItem('Milkshake',            'Vanilla, chocolate, or strawberry',            1500, drinks);
  await addItem('Iced Coffee',          'Cold brew over ice with milk',                 1300, drinks, { discountPct: 10 });
  await addItem('Fresh Orange Juice',   'Freshly squeezed, no added sugar',             1400, drinks);
  await addItem('Sparkling Water',      '500 ml glass bottle',                          1000, drinks);

  // Sides
  await addItem('French Fries',         'Crispy golden fries with sea salt',            1100, sides, { largePrice: 1499 });
  await addItem('Sweet Potato Fries',   'Oven-baked sweet potato fries',                1300, sides, { largePrice: 1699, discountPct: 5 });
  await addItem('Onion Rings',          'Beer-battered crispy onion rings',             1250, sides);
  await addItem('Coleslaw',             'Creamy house-made coleslaw',                   1000, sides);
  await addItem('Garlic Bread',         'Toasted baguette with herb butter',            1150, sides);
  await addItem('Side Salad',           'Mixed greens, cherry tomatoes, vinaigrette',   1100, sides);

  // Desserts
  await addItem('Chocolate Brownie',    'Warm brownie served with vanilla ice cream',   1400, desserts);
  await addItem('Ice Cream',            'Two scoops — choice of three flavours',        1200, desserts, { discountPct: 10 });
  await addItem('Cheesecake',           'New York-style with berry coulis',             1600, desserts);
  await addItem('Apple Pie',            'Warm spiced apple pie with cream',             1350, desserts);
  await addItem('Waffle',               'Belgian waffle with maple syrup and berries',  1750, desserts);

  // Pizza
  await addItem('Margherita',           'San Marzano tomato, mozzarella, fresh basil',  2499, pizza, { largePrice: 3499 });
  await addItem('Pepperoni',            'Double pepperoni, mozzarella, tomato base',    2799, pizza, { largePrice: 3799, discountPct: 5 });
  await addItem('BBQ Chicken',          'BBQ pulled chicken, red onion, smoked cheese', 2999, pizza, { largePrice: 3999 });
  await addItem('Veggie Supreme',       'Roasted peppers, olives, mushrooms, onion',    2599, pizza, { largePrice: 3599, discountPct: 10, largeDiscountPct: 10 });

  await addTable(1, 2); await addTable(2, 4); await addTable(3, 4);
  await addTable(4, 6); await addTable(5, 2); await addTable(6, 8);

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

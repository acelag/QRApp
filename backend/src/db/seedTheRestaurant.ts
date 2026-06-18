import 'dotenv/config';
import { randomUUID } from 'crypto';
import { pool } from './database';

const RESTAURANT_ID = 'bebf4749-0d25-4d81-bdf6-1fa277b51f61';

const categoryImages: Record<string, string> = {
  'Starters':      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
  'Salads':        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  'Soups':         'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
  'Burgers':       'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'Pizza':         'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
  'Pasta':         'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  'Grills':        'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80',
  'Rice & Noodles':'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'Desserts':      'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80',
  'Beverages':     'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
};

const MENU: { category: string; name: string; price: number; description?: string }[] = [
  // Starters
  { category: 'Starters', name: 'Crispy Calamari',         price: 950,  description: 'Lightly breaded calamari with marinara sauce' },
  { category: 'Starters', name: 'Chicken Wings',           price: 1100, description: 'BBQ or buffalo sauce, served with celery sticks' },
  { category: 'Starters', name: 'Bruschetta',              price: 750,  description: 'Toasted bread with tomato, basil and olive oil' },
  { category: 'Starters', name: 'Garlic Bread',            price: 550,  description: 'Toasted with garlic butter and herbs' },
  { category: 'Starters', name: 'Spring Rolls',            price: 800,  description: 'Crispy vegetable spring rolls with sweet chili dip' },
  { category: 'Starters', name: 'Stuffed Mushrooms',       price: 900,  description: 'Filled with cream cheese and herbs' },

  // Salads
  { category: 'Salads', name: 'Caesar Salad',              price: 900,  description: 'Romaine lettuce, croutons, parmesan, caesar dressing' },
  { category: 'Salads', name: 'Greek Salad',               price: 850,  description: 'Cucumber, olives, feta, tomato, red onion' },
  { category: 'Salads', name: 'Garden Fresh Salad',        price: 700,  description: 'Seasonal vegetables with house dressing' },
  { category: 'Salads', name: 'Grilled Chicken Salad',     price: 1100, description: 'Mixed greens, grilled chicken, avocado, balsamic' },

  // Soups
  { category: 'Soups', name: 'Tomato Basil Soup',          price: 650,  description: 'Creamy homemade tomato soup with fresh basil' },
  { category: 'Soups', name: 'Cream of Mushroom',          price: 700,  description: 'Rich and creamy mushroom soup' },
  { category: 'Soups', name: 'Chicken Noodle Soup',        price: 750,  description: 'Classic comfort soup with egg noodles' },
  { category: 'Soups', name: 'French Onion Soup',          price: 800,  description: 'With gruyere crouton' },

  // Burgers
  { category: 'Burgers', name: 'Classic Beef Burger',      price: 1400, description: 'Beef patty, lettuce, tomato, pickles, special sauce' },
  { category: 'Burgers', name: 'Chicken Burger',           price: 1250, description: 'Grilled chicken, coleslaw, mayo' },
  { category: 'Burgers', name: 'Double Smash Burger',      price: 1800, description: 'Two smash patties, cheese, caramelized onions' },
  { category: 'Burgers', name: 'Mushroom Swiss Burger',    price: 1550, description: 'Beef patty, sautéed mushrooms, swiss cheese' },
  { category: 'Burgers', name: 'Veggie Burger',            price: 1100, description: 'Plant-based patty with avocado and greens' },
  { category: 'Burgers', name: 'BBQ Bacon Burger',         price: 1650, description: 'Beef patty, crispy bacon, BBQ sauce, onion rings' },

  // Pizza
  { category: 'Pizza', name: 'Margherita',                 price: 1600, description: 'Tomato sauce, fresh mozzarella, basil' },
  { category: 'Pizza', name: 'Pepperoni',                  price: 1900, description: 'Tomato sauce, mozzarella, pepperoni' },
  { category: 'Pizza', name: 'BBQ Chicken',                price: 2100, description: 'BBQ sauce, chicken, red onion, cilantro' },
  { category: 'Pizza', name: 'Veggie Supreme',             price: 1800, description: 'Bell peppers, mushrooms, olives, onions, tomatoes' },
  { category: 'Pizza', name: 'Meat Lovers',                price: 2400, description: 'Pepperoni, sausage, bacon, ham, beef' },
  { category: 'Pizza', name: 'Four Cheese',                price: 2000, description: 'Mozzarella, cheddar, parmesan, gorgonzola' },

  // Pasta
  { category: 'Pasta', name: 'Spaghetti Bolognese',        price: 1400, description: 'Slow-cooked beef ragu, parmesan' },
  { category: 'Pasta', name: 'Chicken Alfredo',            price: 1600, description: 'Fettuccine in creamy alfredo sauce with chicken' },
  { category: 'Pasta', name: 'Penne Arrabbiata',           price: 1250, description: 'Spicy tomato sauce, garlic, chili flakes' },
  { category: 'Pasta', name: 'Seafood Linguine',           price: 2100, description: 'Shrimp, calamari, mussels in white wine sauce' },
  { category: 'Pasta', name: 'Mushroom Carbonara',         price: 1500, description: 'Creamy egg sauce with mushrooms and parmesan' },

  // Grills
  { category: 'Grills', name: 'Grilled Chicken Breast',   price: 1800, description: 'Herb marinated chicken with seasonal vegetables' },
  { category: 'Grills', name: 'Ribeye Steak 250g',        price: 3500, description: 'Served with mashed potato and grilled asparagus' },
  { category: 'Grills', name: 'Lamb Chops',               price: 3200, description: 'Herb crusted lamb with mint jelly' },
  { category: 'Grills', name: 'Grilled Salmon',           price: 2800, description: 'With lemon butter sauce and steamed vegetables' },
  { category: 'Grills', name: 'Mixed Grill Platter',      price: 3800, description: 'Chicken, beef, lamb, sausage with fries and salad' },

  // Rice & Noodles
  { category: 'Rice & Noodles', name: 'Chicken Fried Rice',  price: 1100, description: 'Wok-fried rice with chicken, egg and vegetables' },
  { category: 'Rice & Noodles', name: 'Beef Fried Rice',     price: 1250, description: 'Wok-fried rice with beef strips and vegetables' },
  { category: 'Rice & Noodles', name: 'Vegetable Fried Rice',price: 950,  description: 'Wok-fried rice with mixed vegetables' },
  { category: 'Rice & Noodles', name: 'Pad Thai',            price: 1400, description: 'Rice noodles, shrimp, peanuts, bean sprouts' },
  { category: 'Rice & Noodles', name: 'Chicken Noodles',     price: 1200, description: 'Stir-fried egg noodles with chicken and vegetables' },

  // Desserts
  { category: 'Desserts', name: 'Chocolate Lava Cake',    price: 850,  description: 'Warm chocolate cake with vanilla ice cream' },
  { category: 'Desserts', name: 'New York Cheesecake',    price: 800,  description: 'Classic cheesecake with berry compote' },
  { category: 'Desserts', name: 'Tiramisu',               price: 900,  description: 'Classic Italian dessert with espresso and mascarpone' },
  { category: 'Desserts', name: 'Ice Cream (3 Scoops)',   price: 650,  description: 'Vanilla, chocolate or strawberry' },
  { category: 'Desserts', name: 'Crème Brûlée',           price: 850,  description: 'Classic French custard with caramelized sugar' },
  { category: 'Desserts', name: 'Brownie Sundae',         price: 900,  description: 'Warm brownie, ice cream, chocolate sauce, nuts' },

  // Beverages
  { category: 'Beverages', name: 'Fresh Lemonade',        price: 450,  description: 'Freshly squeezed lemon juice with mint' },
  { category: 'Beverages', name: 'Iced Coffee',           price: 500,  description: 'Cold brew over ice with milk' },
  { category: 'Beverages', name: 'Mango Smoothie',        price: 550,  description: 'Fresh mango blended with yogurt' },
  { category: 'Beverages', name: 'Strawberry Milkshake',  price: 600,  description: 'Thick strawberry milkshake with whipped cream' },
  { category: 'Beverages', name: 'Fresh Orange Juice',    price: 500,  description: 'Freshly squeezed oranges' },
  { category: 'Beverages', name: 'Mineral Water',         price: 200  },
  { category: 'Beverages', name: 'Soft Drink (Can)',      price: 300,  description: 'Coke, Sprite, Fanta' },
  { category: 'Beverages', name: 'Hot Coffee',            price: 400,  description: 'Americano, latte or cappuccino' },
  { category: 'Beverages', name: 'Hot Tea',               price: 350,  description: 'English breakfast, green or herbal' },
];

const TABLES = [
  { number: 1, seats: 2 }, { number: 2, seats: 2 }, { number: 3, seats: 4 },
  { number: 4, seats: 4 }, { number: 5, seats: 4 }, { number: 6, seats: 6 },
  { number: 7, seats: 6 }, { number: 8, seats: 8 }, { number: 9, seats: 8 },
  { number: 10, seats: 10 },
];

async function findOrCreateCategory(name: string): Promise<string> {
  const ex = await pool.query(
    'SELECT id FROM categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)',
    [RESTAURANT_ID, name],
  );
  if (ex.rows.length) return ex.rows[0].id as string;
  const id = randomUUID();
  await pool.query(
    'INSERT INTO categories (id, restaurant_id, name) VALUES ($1,$2,$3)',
    [id, RESTAURANT_ID, name],
  );
  return id;
}

async function main() {
  // Menu items
  const categoryIds = new Map<string, string>();
  let created = 0;
  for (const item of MENU) {
    let catId = categoryIds.get(item.category);
    if (!catId) { catId = await findOrCreateCategory(item.category); categoryIds.set(item.category, catId); }
    const ex = await pool.query(
      'SELECT id FROM menu_items WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)',
      [RESTAURANT_ID, item.name],
    );
    if (ex.rows.length) continue;
    const sortOrder = MENU.filter(m => m.category === item.category).indexOf(item);
    await pool.query(
      `INSERT INTO menu_items
        (id, restaurant_id, name, description, price, discount_pct, category_id, image, available, track_stock, sort_order, tags, prep_time_mins, schedule_id)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,TRUE,FALSE,$8,'[]',NULL,NULL)`,
      [randomUUID(), RESTAURANT_ID, item.name, item.description ?? '', item.price, catId, categoryImages[item.category] ?? null, sortOrder],
    );
    created++;
  }
  console.log(`✓ Menu: ${categoryIds.size} categories, ${created} items created`);

  // Tables
  let tCreated = 0;
  for (const t of TABLES) {
    const ex = await pool.query('SELECT id FROM tables WHERE restaurant_id = $1 AND number = $2', [RESTAURANT_ID, t.number]);
    if (ex.rows.length) continue;
    await pool.query('INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES ($1,$2,$3,$4,TRUE)', [randomUUID(), RESTAURANT_ID, t.number, t.seats]);
    tCreated++;
  }
  console.log(`✓ Tables: ${tCreated} created`);
}

main().catch(console.error).finally(() => pool.end());

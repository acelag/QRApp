import { pool } from './database';

export async function createSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
      name               VARCHAR(255)  NOT NULL,
      slug               VARCHAR(100)  NOT NULL UNIQUE,
      active             BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at         VARCHAR(50)   NOT NULL,
      service_charge_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,
      tax_pct            DECIMAL(5,2)  NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      name          VARCHAR(255) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)   NOT NULL,
      name          VARCHAR(255)  NOT NULL,
      description   VARCHAR(1000) NOT NULL DEFAULT '',
      price         DECIMAL(10,2) NOT NULL,
      discount_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0,
      category_id   VARCHAR(36)   NOT NULL REFERENCES categories(id),
      image         VARCHAR(500)  NULL,
      available     BOOLEAN       NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tables (
      id            VARCHAR(36) NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36) NOT NULL,
      number        INTEGER     NOT NULL,
      seats         INTEGER     NOT NULL,
      active        BOOLEAN     NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_sessions (
      id            VARCHAR(36) NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36) NOT NULL,
      table_id      VARCHAR(36) NOT NULL,
      table_number  INTEGER     NOT NULL,
      status        VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at    VARCHAR(50) NOT NULL,
      closed_at     VARCHAR(50) NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)   NOT NULL,
      session_id    VARCHAR(36)   NULL,
      table_id      VARCHAR(36)   NULL,
      table_number  INTEGER       NULL,
      order_type    VARCHAR(20)   NOT NULL DEFAULT 'dine-in',
      customer_name VARCHAR(255)  NULL,
      status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
      total_amount  DECIMAL(10,2) NOT NULL,
      created_at    VARCHAR(50)   NOT NULL,
      updated_at    VARCHAR(50)   NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           VARCHAR(36)   NOT NULL PRIMARY KEY,
      order_id     VARCHAR(36)   NOT NULL REFERENCES orders(id),
      menu_item_id VARCHAR(36)   NOT NULL,
      name         VARCHAR(255)  NOT NULL,
      price        DECIMAL(10,2) NOT NULL,
      quantity     INTEGER       NOT NULL,
      notes        VARCHAR(500)  NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NULL,
      username      VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(255) NOT NULL,
      role          VARCHAR(20)  NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_item_toppings (
      id           VARCHAR(36)   NOT NULL PRIMARY KEY,
      menu_item_id VARCHAR(36)   NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name         VARCHAR(100)  NOT NULL,
      price        DECIMAL(10,2) NOT NULL DEFAULT 0,
      available    BOOLEAN       NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_item_toppings (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      order_item_id VARCHAR(36)   NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      topping_id    VARCHAR(36)   NULL REFERENCES menu_item_toppings(id) ON DELETE SET NULL,
      name          VARCHAR(100)  NOT NULL,
      price         DECIMAL(10,2) NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      endpoint      TEXT         NOT NULL,
      p256dh        VARCHAR(500) NOT NULL,
      auth          VARCHAR(100) NOT NULL,
      created_at    VARCHAR(50)  NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      number        INTEGER      NOT NULL,
      name          VARCHAR(255) NULL,
      created_at    VARCHAR(50)  NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)   NOT NULL,
      code          VARCHAR(50)   NOT NULL,
      type          VARCHAR(20)   NOT NULL DEFAULT 'percentage',
      value         DECIMAL(10,2) NOT NULL,
      min_order     DECIMAL(10,2) NOT NULL DEFAULT 0,
      max_uses      INTEGER       NULL,
      uses          INTEGER       NOT NULL DEFAULT 0,
      active        BOOLEAN       NOT NULL DEFAULT TRUE,
      expires_at    VARCHAR(50)   NULL,
      created_at    VARCHAR(50)   NOT NULL,
      UNIQUE(restaurant_id, code)
    );
  `);

  // Safe column additions for older databases
  const addCol = async (table: string, col: string, def: string) => {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
  };
  await addCol('restaurants', 'service_charge_pct',   'DECIMAL(5,2) NOT NULL DEFAULT 0');
  await addCol('restaurants', 'tax_pct',               'DECIMAL(5,2) NOT NULL DEFAULT 0');
  await addCol('restaurants', 'currency',              "VARCHAR(10) NOT NULL DEFAULT 'USD'");
  await addCol('restaurants', 'logo',                  'VARCHAR(500) NULL');
  await addCol('restaurants', 'theme_color',           "VARCHAR(20) NOT NULL DEFAULT '#f97316'");
  await addCol('restaurants', 'order_number_prefix',   "VARCHAR(20) NOT NULL DEFAULT 'ORD'");
  await addCol('restaurants', 'next_order_seq',        'INTEGER NOT NULL DEFAULT 0');
  await addCol('menu_items',  'sort_order',              'INTEGER NOT NULL DEFAULT 0');
  await addCol('menu_items',  'discount_pct',           'DECIMAL(5,2) NOT NULL DEFAULT 0');
  await addCol('menu_items',  'large_price',            'DECIMAL(10,2) NULL');
  await addCol('menu_items',  'large_discount_pct',     'DECIMAL(5,2) NOT NULL DEFAULT 0');
  await addCol('order_items', 'size',                   "VARCHAR(10) NULL");
  await addCol('orders',      'order_number',           'VARCHAR(30) NULL');
  await addCol('orders',      'room_id',                'VARCHAR(36) NULL');
  await addCol('orders',      'room_number',            'INTEGER NULL');
  await addCol('restaurants', 'wait_time_min',          'INTEGER NULL');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
      id         VARCHAR(36)  NOT NULL PRIMARY KEY,
      order_id   VARCHAR(36)  NOT NULL,
      endpoint   TEXT         NOT NULL,
      p256dh     VARCHAR(500) NOT NULL,
      auth       VARCHAR(100) NOT NULL,
      created_at VARCHAR(50)  NOT NULL
    );
  `);

  await addCol('orders',          'promo_code',       'VARCHAR(50) NULL');
  await addCol('orders',          'discount_amount',  'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await addCol('orders',          'payment_method',   'VARCHAR(30) NULL');
  await addCol('table_sessions',  'payment_method',   'VARCHAR(30) NULL');
  await addCol('orders',          'customer_phone',        'VARCHAR(30) NULL');
  await addCol('restaurants',     'room_service_open',     'VARCHAR(5) NULL');
  await addCol('restaurants',     'room_service_close',    'VARCHAR(5) NULL');
  await addCol('menu_items',      'track_stock',           'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('menu_items',      'stock',                 'INTEGER NULL');
  await addCol('menu_items',      'tags',                  "VARCHAR(500) NOT NULL DEFAULT '[]'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS waiters (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      name          VARCHAR(255) NOT NULL,
      active        BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at    VARCHAR(50)  NOT NULL
    );
  `);
  await addCol('orders', 'assigned_waiter_id',   'VARCHAR(36) NULL');
  await addCol('orders', 'assigned_waiter_name', 'VARCHAR(255) NULL');
  await addCol('orders', 'served_at',            'VARCHAR(50) NULL'); // stamped when status → served


  await addCol('table_sessions', 'merged_into_session_id', 'VARCHAR(36) NULL');

  // ── Dynamic tags table ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      slug          VARCHAR(50)  NOT NULL,
      label         VARCHAR(100) NOT NULL,
      emoji         VARCHAR(10)  NOT NULL DEFAULT '🏷️',
      sort_order    INTEGER      NOT NULL DEFAULT 0,
      UNIQUE(restaurant_id, slug)
    );
  `);

  // Seed default tags for any restaurant that currently has none
  {
    const DEFAULT_TAGS = [
      { slug: 'spicy',        label: 'Spicy',       emoji: '🌶' },
      { slug: 'vegan',        label: 'Vegan',       emoji: '🌱' },
      { slug: 'popular',      label: 'Popular',     emoji: '⭐' },
      { slug: 'new',          label: 'New',         emoji: '🆕' },
      { slug: 'vegetarian',   label: 'Vegetarian',  emoji: '🥦' },
      { slug: 'gluten-free',  label: 'Gluten-Free', emoji: '🌾' },
      { slug: 'halal',        label: 'Halal',       emoji: '✅' },
    ];
    const restRes = await pool.query(
      `SELECT r.id FROM restaurants r
       WHERE NOT EXISTS (SELECT 1 FROM tags t WHERE t.restaurant_id = r.id)`
    );
    for (const rest of restRes.rows as { id: string }[]) {
      for (let i = 0; i < DEFAULT_TAGS.length; i++) {
        const t = DEFAULT_TAGS[i];
        await pool.query(
          `INSERT INTO tags (id, restaurant_id, slug, label, emoji, sort_order)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [rest.id, t.slug, t.label, t.emoji, i],
        );
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id             VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id  VARCHAR(36)   NOT NULL,
      table_id       VARCHAR(36)   NULL,
      table_number   INTEGER       NULL,
      customer_name  VARCHAR(255)  NOT NULL,
      customer_phone VARCHAR(30)   NULL,
      party_size     INTEGER       NOT NULL DEFAULT 1,
      date           VARCHAR(10)   NOT NULL,
      time           VARCHAR(5)    NOT NULL,
      status         VARCHAR(20)   NOT NULL DEFAULT 'pending',
      notes          VARCHAR(500)  NULL,
      created_at     VARCHAR(50)   NOT NULL
    );
  `);

  console.log('✓ Schema ready');
}

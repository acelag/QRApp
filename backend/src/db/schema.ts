import { pool } from './database';

// Helper — add a nullable column only if it doesn't already exist
async function addColumn(table: string, column: string, type: string) {
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
    )
    ALTER TABLE ${table} ADD ${column} ${type} NULL;
  `);
}

export async function createSchema(): Promise<void> {
  // ── Core lookup table: must exist before foreign-key refs ────────────────
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'restaurants')
    CREATE TABLE restaurants (
      id         NVARCHAR(36)  NOT NULL PRIMARY KEY,
      name       NVARCHAR(255) NOT NULL,
      slug       NVARCHAR(100) NOT NULL UNIQUE,
      active     BIT           NOT NULL DEFAULT 1,
      created_at NVARCHAR(50)  NOT NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'categories')
    CREATE TABLE categories (
      id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)  NOT NULL,
      name          NVARCHAR(255) NOT NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'menu_items')
    CREATE TABLE menu_items (
      id            NVARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)   NOT NULL,
      name          NVARCHAR(255)  NOT NULL,
      description   NVARCHAR(1000) NOT NULL DEFAULT '',
      price         DECIMAL(10,2)  NOT NULL,
      category_id   NVARCHAR(36)   NOT NULL REFERENCES categories(id),
      image         NVARCHAR(500)  NULL,
      available     BIT            NOT NULL DEFAULT 1
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tables')
    CREATE TABLE tables (
      id            NVARCHAR(36) NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36) NOT NULL,
      number        INT          NOT NULL,
      seats         INT          NOT NULL,
      active        BIT          NOT NULL DEFAULT 1
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'table_sessions')
    CREATE TABLE table_sessions (
      id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)  NOT NULL,
      table_id      NVARCHAR(36)  NOT NULL,
      table_number  INT           NOT NULL,
      status        NVARCHAR(20)  NOT NULL DEFAULT 'open',
      created_at    NVARCHAR(50)  NOT NULL,
      closed_at     NVARCHAR(50)  NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'orders')
    CREATE TABLE orders (
      id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)  NOT NULL,
      session_id    NVARCHAR(36)  NULL,
      table_id      NVARCHAR(36)  NULL,
      table_number  INT           NULL,
      order_type    NVARCHAR(20)  NOT NULL DEFAULT 'dine-in',
      customer_name NVARCHAR(255) NULL,
      status        NVARCHAR(20)  NOT NULL DEFAULT 'pending',
      total_amount  DECIMAL(10,2) NOT NULL,
      created_at    NVARCHAR(50)  NOT NULL,
      updated_at    NVARCHAR(50)  NOT NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'order_items')
    CREATE TABLE order_items (
      id           NVARCHAR(36)   NOT NULL PRIMARY KEY,
      order_id     NVARCHAR(36)   NOT NULL REFERENCES orders(id),
      menu_item_id NVARCHAR(36)   NOT NULL,
      name         NVARCHAR(255)  NOT NULL,
      price        DECIMAL(10,2)  NOT NULL,
      quantity     INT            NOT NULL,
      notes        NVARCHAR(500)  NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
    CREATE TABLE users (
      id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)  NULL,
      username      NVARCHAR(100) NOT NULL UNIQUE,
      password_hash NVARCHAR(255) NOT NULL,
      name          NVARCHAR(255) NOT NULL,
      role          NVARCHAR(20)  NOT NULL
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'push_subscriptions')
    CREATE TABLE push_subscriptions (
      id            NVARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id NVARCHAR(36)  NOT NULL,
      endpoint      NVARCHAR(MAX) NOT NULL,
      p256dh        NVARCHAR(500) NOT NULL,
      auth          NVARCHAR(100) NOT NULL,
      created_at    NVARCHAR(50)  NOT NULL
    );
  `);

  // ── Migrations: add restaurant_id to tables that pre-date this feature ────
  await addColumn('categories',        'restaurant_id', 'NVARCHAR(36)');
  await addColumn('menu_items',        'restaurant_id', 'NVARCHAR(36)');
  await addColumn('tables',            'restaurant_id', 'NVARCHAR(36)');
  await addColumn('table_sessions',    'restaurant_id', 'NVARCHAR(36)');
  await addColumn('orders',            'restaurant_id', 'NVARCHAR(36)');
  await addColumn('orders',            'session_id',    'NVARCHAR(36)');
  await addColumn('orders',            'order_type',    "NVARCHAR(20) DEFAULT 'dine-in'");
  await addColumn('orders',            'customer_name', 'NVARCHAR(255)');

  // Make table_id / table_number nullable for takeaway orders
  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'table_id'
        AND IS_NULLABLE = 'NO'
    )
    ALTER TABLE orders ALTER COLUMN table_id NVARCHAR(36) NULL;
  `);
  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'table_number'
        AND IS_NULLABLE = 'NO'
    )
    ALTER TABLE orders ALTER COLUMN table_number INT NULL;
  `);
  await addColumn('users',             'restaurant_id', 'NVARCHAR(36)');
  await addColumn('push_subscriptions','restaurant_id', 'NVARCHAR(36)');

  // ── Add active flag to restaurants (existing DBs) ─────────────────────────
  await addColumn('restaurants', 'active', 'BIT DEFAULT 1');
  await pool.request().query(`UPDATE restaurants SET active = 1 WHERE active IS NULL`);

  // ── Per-item discount ─────────────────────────────────────────────────────
  await addColumn('menu_items', 'discount_pct', 'DECIMAL(5,2) DEFAULT 0');
  await pool.request().query(`UPDATE menu_items SET discount_pct = 0 WHERE discount_pct IS NULL`);

  // ── Add billing config columns to restaurants ─────────────────────────────
  await addColumn('restaurants', 'service_charge_pct', 'DECIMAL(5,2) DEFAULT 0');
  await addColumn('restaurants', 'tax_pct',            'DECIMAL(5,2) DEFAULT 0');
  await pool.request().query(`
    UPDATE restaurants
    SET service_charge_pct = 0, tax_pct = 0
    WHERE service_charge_pct IS NULL OR tax_pct IS NULL
  `);

  // ── Drop old global UNIQUE constraint on tables.number (pre-multi-tenant) ─
  // In a multi-tenant setup, table numbers only need to be unique per restaurant.
  await pool.request().query(`
    DECLARE @cname NVARCHAR(256);
    SELECT @cname = kc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS kc
      ON kcu.CONSTRAINT_NAME = kc.CONSTRAINT_NAME
    WHERE kcu.TABLE_NAME = 'tables'
      AND kcu.COLUMN_NAME = 'number'
      AND kc.CONSTRAINT_TYPE = 'UNIQUE';
    IF @cname IS NOT NULL
      EXEC('ALTER TABLE tables DROP CONSTRAINT [' + @cname + ']');
  `);

  console.log('✓ Schema ready');
}

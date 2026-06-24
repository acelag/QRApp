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
  await addCol('restaurants', 'theme_color',           "VARCHAR(20) NOT NULL DEFAULT '#2a7344'");
  // Re-skin: forest green is the new brand default. Update the live column
  // default and migrate restaurants still on the legacy orange default.
  await pool.query("ALTER TABLE restaurants ALTER COLUMN theme_color SET DEFAULT '#2a7344'");
  await pool.query("UPDATE restaurants SET theme_color = '#2a7344' WHERE theme_color = '#f97316'");
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
  await addCol('restaurants', 'timezone',               "VARCHAR(64) NOT NULL DEFAULT 'UTC'");
  await addCol('users',       'permissions',            "JSONB NOT NULL DEFAULT '[]'::jsonb");
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
  await addCol('orders', 'rating',        'SMALLINT NULL');
  await addCol('orders', 'feedback_note', 'VARCHAR(500) NULL');
  await addCol('menu_items', 'prep_time_mins', 'SMALLINT NULL');
  await addCol('restaurants', 'facebook_url',  'VARCHAR(500) NULL');
  await addCol('restaurants', 'instagram_url', 'VARCHAR(500) NULL');
  await addCol('restaurants', 'welcome_image_url', 'VARCHAR(500) NULL');
  await addCol('restaurants', 'login_media',     "JSONB NOT NULL DEFAULT '[]'::jsonb");
  await addCol('restaurants', 'login_video_url', 'VARCHAR(500) NULL');
  await addCol('restaurants', 'tiktok_url',   'VARCHAR(500) NULL');
  await addCol('restaurants', 'whatsapp_url', 'VARCHAR(500) NULL');
  await addCol('restaurants', 'youtube_url',  'VARCHAR(500) NULL');
  await addCol('restaurants', 'twitter_url',  'VARCHAR(500) NULL');
  await addCol('restaurants', 'welcome_heading', 'VARCHAR(120) NULL');
  await addCol('restaurants', 'welcome_tagline', 'VARCHAR(200) NULL');
  await addCol('restaurants', 'banner_image',    'VARCHAR(500) NULL');
  await addCol('restaurants', 'enabled_payment_methods', `JSONB NOT NULL DEFAULT '["cash","card","online","voucher"]'`);

  // Printer settings
  await addCol('restaurants', 'receipt_printer_ip',   'VARCHAR(100) NULL');
  await addCol('restaurants', 'receipt_printer_port',  'INTEGER NOT NULL DEFAULT 9100');
  await addCol('restaurants', 'kitchen_printer_ip',   'VARCHAR(100) NULL');
  await addCol('restaurants', 'kitchen_printer_port',  'INTEGER NOT NULL DEFAULT 9100');
  await addCol('restaurants', 'printer_type',          "VARCHAR(20) NOT NULL DEFAULT 'epson'");
  await addCol('restaurants', 'auto_print_kitchen',    'BOOLEAN NOT NULL DEFAULT FALSE');
  await addCol('restaurants', 'auto_print_receipt',    'BOOLEAN NOT NULL DEFAULT FALSE');

  // Per-restaurant feature flags (super_admin can toggle per restaurant)
  await addCol('restaurants', 'features', "JSONB NOT NULL DEFAULT '{}'::jsonb");

  // ── Subscription / billing ──────────────────────────────────────────────
  // Existing restaurants default to an active 'pro' plan so nothing is gated
  // for current tenants; self-serve signups set 'trialing'/'free' explicitly.
  await addCol('restaurants', 'plan',                "VARCHAR(20) NOT NULL DEFAULT 'pro'");
  await addCol('restaurants', 'subscription_status', "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addCol('restaurants', 'trial_ends_at',       'VARCHAR(50) NULL');
  await addCol('restaurants', 'current_period_end',  'VARCHAR(50) NULL');
  await addCol('restaurants', 'billing_customer_id', 'VARCHAR(120) NULL');
  await addCol('restaurants', 'billing_provider',    'VARCHAR(40) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      code        VARCHAR(20)   NOT NULL PRIMARY KEY,
      name        VARCHAR(60)   NOT NULL,
      tagline     VARCHAR(200)  NOT NULL DEFAULT '',
      price_lkr   INTEGER       NOT NULL DEFAULT 0,
      price_usd   INTEGER       NOT NULL DEFAULT 0,
      features    JSONB         NOT NULL DEFAULT '[]'::jsonb,
      highlights  JSONB         NOT NULL DEFAULT '[]'::jsonb,
      sort_order  INTEGER       NOT NULL DEFAULT 0,
      visible     BOOLEAN       NOT NULL DEFAULT TRUE
    );
  `);
  // Annual pricing (added after initial release; 0 = derive/none)
  await addCol('plans', 'price_lkr_year', 'INTEGER NOT NULL DEFAULT 0');
  await addCol('plans', 'price_usd_year', 'INTEGER NOT NULL DEFAULT 0');

  // Global system settings (key/value) — e.g. subscriptions master switch
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   VARCHAR(60)  NOT NULL PRIMARY KEY,
      value TEXT         NOT NULL
    );
  `);

  // Reservations (phone bookings now; online later) — for tables or rooms.
  // A legacy, unused reservations table (date/time/table_number, no rooms) may
  // exist from an earlier schema. Replace it once — guarded by the presence of
  // the new `reserved_at` column so this never drops the live table again.
  {
    const hasNew = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'reserved_at'",
    );
    if (!hasNew.rows.length) {
      const exists = await pool.query("SELECT to_regclass('reservations') AS t");
      if ((exists.rows[0] as { t: string | null }).t) await pool.query('DROP TABLE reservations');
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id             VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id  VARCHAR(36)  NOT NULL,
      type           VARCHAR(10)  NOT NULL,            -- 'table' | 'room'
      table_id       VARCHAR(36)  NULL,
      room_id        VARCHAR(36)  NULL,
      customer_name  VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(40)  NULL,
      party_size     INTEGER      NOT NULL DEFAULT 1,
      reserved_at    VARCHAR(50)  NOT NULL,            -- ISO datetime
      duration_mins  INTEGER      NULL,
      status         VARCHAR(20)  NOT NULL DEFAULT 'booked',
      notes          VARCHAR(500) NULL,
      created_at     VARCHAR(50)  NOT NULL,
      created_by     VARCHAR(36)  NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reservations_rest_time ON reservations (restaurant_id, reserved_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id            SERIAL        PRIMARY KEY,
      external_id   VARCHAR(200)  NOT NULL UNIQUE,
      restaurant_id VARCHAR(36)   NOT NULL,
      provider      VARCHAR(40)   NOT NULL,
      event_type    VARCHAR(40)   NOT NULL,
      payload       JSONB         NOT NULL DEFAULT '{}'::jsonb,
      created_at    VARCHAR(50)   NOT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscription_events_restaurant ON subscription_events (restaurant_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refunds (
      id               VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id    VARCHAR(36)   NOT NULL,
      order_id         VARCHAR(36)   NULL,
      session_id       VARCHAR(36)   NULL,
      amount           DECIMAL(10,2) NOT NULL,
      reason           VARCHAR(500)  NOT NULL,
      refund_method    VARCHAR(30)   NOT NULL,
      created_by       VARCHAR(36)   NOT NULL,
      created_by_name  VARCHAR(255)  NOT NULL,
      created_at       VARCHAR(50)   NOT NULL
    );
  `);

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

  // Add category column to tags (label | dietary | allergen)
  await addCol('tags', 'category', "VARCHAR(20) NOT NULL DEFAULT 'label'");

  // Fix categories for existing tags
  await pool.query(`UPDATE tags SET category = 'dietary' WHERE slug IN ('vegan','vegetarian','gluten-free','halal','kosher') AND category = 'label'`);
  await pool.query(`UPDATE tags SET category = 'allergen' WHERE slug IN ('dairy','eggs','fish','gluten','nuts','peanuts','shellfish','crustaceans','soy','sesame','mustard','celery','sulphites','lupin','molluscs') AND category = 'label'`);

  // Seed all default + allergen tags for every restaurant (ON CONFLICT skips existing)
  {
    const ALL_TAGS: { slug: string; label: string; emoji: string; category: string }[] = [
      // ── Labels ──────────────────────────────────────────────────────
      { slug: 'spicy',       label: 'Spicy',       emoji: '🌶️', category: 'label'    },
      { slug: 'popular',     label: 'Popular',     emoji: '⭐',  category: 'label'    },
      { slug: 'new',         label: 'New',         emoji: '🆕',  category: 'label'    },
      // ── Dietary ─────────────────────────────────────────────────────
      { slug: 'vegan',       label: 'Vegan',       emoji: '🌱',  category: 'dietary'  },
      { slug: 'vegetarian',  label: 'Vegetarian',  emoji: '🥦',  category: 'dietary'  },
      { slug: 'gluten-free', label: 'Gluten-Free', emoji: '🌾',  category: 'dietary'  },
      { slug: 'halal',       label: 'Halal',       emoji: '✅',  category: 'dietary'  },
      // ── Allergens (EU Big 14) ────────────────────────────────────────
      { slug: 'gluten',      label: 'Gluten',      emoji: '🌾',  category: 'allergen' },
      { slug: 'crustaceans', label: 'Crustaceans', emoji: '🦞',  category: 'allergen' },
      { slug: 'eggs',        label: 'Eggs',        emoji: '🥚',  category: 'allergen' },
      { slug: 'fish',        label: 'Fish',        emoji: '🐟',  category: 'allergen' },
      { slug: 'peanuts',     label: 'Peanuts',     emoji: '🥜',  category: 'allergen' },
      { slug: 'soy',         label: 'Soy',         emoji: '🫘',  category: 'allergen' },
      { slug: 'dairy',       label: 'Dairy',       emoji: '🥛',  category: 'allergen' },
      { slug: 'nuts',        label: 'Tree Nuts',   emoji: '🌰',  category: 'allergen' },
      { slug: 'celery',      label: 'Celery',      emoji: '🥬',  category: 'allergen' },
      { slug: 'mustard',     label: 'Mustard',     emoji: '🌭',  category: 'allergen' },
      { slug: 'sesame',      label: 'Sesame',      emoji: '🫙',  category: 'allergen' },
      { slug: 'sulphites',   label: 'Sulphites',   emoji: '⚗️',  category: 'allergen' },
      { slug: 'lupin',       label: 'Lupin',       emoji: '🌸',  category: 'allergen' },
      { slug: 'molluscs',    label: 'Molluscs',    emoji: '🐚',  category: 'allergen' },
    ];
    const restRes = await pool.query('SELECT id FROM restaurants');
    for (const rest of restRes.rows as { id: string }[]) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tags WHERE restaurant_id = $1',
        [rest.id],
      );
      let nextOrder = Number((maxRes.rows[0] as { next: number }).next);
      for (const t of ALL_TAGS) {
        await pool.query(
          `INSERT INTO tags (id, restaurant_id, slug, label, emoji, sort_order, category)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) ON CONFLICT (restaurant_id, slug) DO NOTHING`,
          [rest.id, t.slug, t.label, t.emoji, nextOrder++, t.category],
        );
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_schedules (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      name          VARCHAR(100) NOT NULL,
      days          VARCHAR(50)  NOT NULL DEFAULT 'daily',
      start_time    VARCHAR(5)   NOT NULL,
      end_time      VARCHAR(5)   NOT NULL,
      active        BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at    VARCHAR(50)  NOT NULL
    );
  `);
  await addCol('menu_items',  'schedule_id', 'VARCHAR(36) NULL');
  await addCol('categories',  'schedule_id', 'VARCHAR(36) NULL');

  // ── Combo / Bundle Deals ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS combos (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)   NOT NULL,
      name          VARCHAR(255)  NOT NULL,
      description   VARCHAR(500)  NULL,
      price         DECIMAL(10,2) NOT NULL,
      image         VARCHAR(500)  NULL,
      active        BOOLEAN       NOT NULL DEFAULT TRUE,
      sort_order    INT           NOT NULL DEFAULT 0,
      created_at    VARCHAR(50)   NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS combo_items (
      id           VARCHAR(36) NOT NULL PRIMARY KEY,
      combo_id     VARCHAR(36) NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      menu_item_id VARCHAR(36) NOT NULL,
      quantity     INT         NOT NULL DEFAULT 1,
      sort_order   INT         NOT NULL DEFAULT 0
    );
  `);
  await addCol('order_items', 'combo_id', 'VARCHAR(36) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)  NOT NULL,
      user_id       VARCHAR(36)  NULL,
      staff_name    VARCHAR(255) NOT NULL,
      staff_role    VARCHAR(50)  NOT NULL DEFAULT 'staff',
      date          VARCHAR(10)  NOT NULL,
      start_time    VARCHAR(5)   NOT NULL,
      end_time      VARCHAR(5)   NOT NULL,
      notes         VARCHAR(500) NULL,
      status        VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
      created_at    VARCHAR(50)  NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id            VARCHAR(36)    NOT NULL PRIMARY KEY,
      restaurant_id VARCHAR(36)    NOT NULL,
      name          VARCHAR(255)   NOT NULL,
      unit          VARCHAR(50)    NOT NULL DEFAULT 'piece',
      quantity      DECIMAL(10,3)  NOT NULL DEFAULT 0,
      min_threshold DECIMAL(10,3)  NOT NULL DEFAULT 0,
      cost_per_unit DECIMAL(10,2)  NOT NULL DEFAULT 0,
      category      VARCHAR(100)   NULL,
      created_at    VARCHAR(50)    NOT NULL,
      updated_at    VARCHAR(50)    NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id             VARCHAR(36)   NOT NULL PRIMARY KEY,
      stock_item_id  VARCHAR(36)   NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      restaurant_id  VARCHAR(36)   NOT NULL,
      type           VARCHAR(10)   NOT NULL CHECK (type IN ('in','out')),
      quantity       DECIMAL(10,3) NOT NULL,
      reason         VARCHAR(100)  NULL,
      notes          VARCHAR(500)  NULL,
      created_by     VARCHAR(36)   NULL,
      created_by_name VARCHAR(255) NULL,
      created_at     VARCHAR(50)   NOT NULL
    );
  `);

  await addCol('tables', 'floor_x',     'FLOAT NULL');
  await addCol('tables', 'floor_y',     'FLOAT NULL');
  await addCol('tables', 'floor_shape', "VARCHAR(10) NOT NULL DEFAULT 'rect'");

  // ── Loyalty / points system ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_configs (
      id                VARCHAR(36)   NOT NULL PRIMARY KEY,
      restaurant_id     VARCHAR(36)   NOT NULL UNIQUE,
      enabled           BOOLEAN       NOT NULL DEFAULT FALSE,
      points_per_unit   DECIMAL(10,4) NOT NULL DEFAULT 1.0,
      redeem_rate       INTEGER       NOT NULL DEFAULT 100,
      min_redeem_points INTEGER       NOT NULL DEFAULT 100,
      max_redeem_pct    DECIMAL(5,2)  NOT NULL DEFAULT 50.0,
      created_at        VARCHAR(50)   NOT NULL,
      updated_at        VARCHAR(50)   NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id              VARCHAR(36)  NOT NULL PRIMARY KEY,
      restaurant_id   VARCHAR(36)  NOT NULL,
      phone           VARCHAR(30)  NOT NULL,
      name            VARCHAR(255) NULL,
      points_balance  INTEGER      NOT NULL DEFAULT 0,
      lifetime_points INTEGER      NOT NULL DEFAULT 0,
      created_at      VARCHAR(50)  NOT NULL,
      updated_at      VARCHAR(50)  NOT NULL,
      UNIQUE(restaurant_id, phone)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id          VARCHAR(36)  NOT NULL PRIMARY KEY,
      account_id  VARCHAR(36)  NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      order_id    VARCHAR(36)  NULL,
      type        VARCHAR(20)  NOT NULL CHECK (type IN ('earn','redeem','adjust')),
      points      INTEGER      NOT NULL,
      description VARCHAR(255) NULL,
      created_at  VARCHAR(50)  NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id            VARCHAR(36)   NOT NULL PRIMARY KEY,
      menu_item_id  VARCHAR(36)   NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      stock_item_id VARCHAR(36)   NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      quantity      DECIMAL(10,3) NOT NULL,
      UNIQUE(menu_item_id, stock_item_id)
    );
  `);

  // ── VAT / tax line items ────────────────────────────────────────────────────
  await addCol('orders',      'tax_amount',            'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await addCol('orders',      'service_charge_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await addCol('restaurants', 'tax_name',              "VARCHAR(30) NOT NULL DEFAULT 'Tax'");
  await addCol('restaurants', 'service_charge_name',   "VARCHAR(30) NOT NULL DEFAULT 'Service Charge'");

  // ── Receipt customization ───────────────────────────────────────────────────
  await addCol('restaurants', 'receipt_header_line1',    "VARCHAR(100) NOT NULL DEFAULT ''");
  await addCol('restaurants', 'receipt_header_line2',    "VARCHAR(100) NOT NULL DEFAULT ''");
  await addCol('restaurants', 'receipt_footer_line1',    "VARCHAR(100) NOT NULL DEFAULT 'Thank you for dining with us!'");
  await addCol('restaurants', 'receipt_footer_line2',    "VARCHAR(100) NOT NULL DEFAULT 'Please come again'");
  await addCol('restaurants', 'receipt_show_order_no',   'BOOLEAN NOT NULL DEFAULT TRUE');
  await addCol('restaurants', 'receipt_show_unit_price', 'BOOLEAN NOT NULL DEFAULT TRUE');

  // ── Currency conversion ────────────────────────────────────────────────────
  await addCol('restaurants', 'display_currency',     'VARCHAR(10) NULL');
  await addCol('restaurants', 'exchange_rate_manual', 'DECIMAL(15,6) NULL');
  await addCol('restaurants', 'display_currencies', "JSONB NOT NULL DEFAULT '[]'");

  // ── Nutritional info ───────────────────────────────────────────────────────
  await addCol('menu_items', 'calories',    'SMALLINT NULL');
  await addCol('menu_items', 'protein_g',   'SMALLINT NULL');
  await addCol('menu_items', 'spice_level', 'SMALLINT NULL');

  // ── Audit log (super-admin activity trail) ──────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            BIGSERIAL    PRIMARY KEY,
      restaurant_id VARCHAR(36)  NULL,
      user_id       VARCHAR(36)  NULL,
      user_name     VARCHAR(255) NOT NULL DEFAULT '',
      user_role     VARCHAR(20)  NOT NULL DEFAULT '',
      action        VARCHAR(60)  NOT NULL,
      entity_type   VARCHAR(40)  NULL,
      entity_id     VARCHAR(64)  NULL,
      summary       VARCHAR(500) NOT NULL DEFAULT '',
      ip            VARCHAR(60)  NULL,
      created_at    VARCHAR(50)  NOT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant ON audit_logs (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)`);

  // ── Performance indexes ─────────────────────────────────────────────────────
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (category_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON orders (restaurant_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant ON table_sessions (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_combos_restaurant ON combos (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_restaurant ON loyalty_accounts (restaurant_id, phone)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_items_restaurant ON stock_items (restaurant_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_session ON orders (session_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_type_status ON orders (order_type, status)`);

  // ── Modifier Groups ─────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS modifier_groups (
      id           VARCHAR(36)  NOT NULL PRIMARY KEY,
      menu_item_id VARCHAR(36)  NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      name         VARCHAR(255) NOT NULL,
      type         VARCHAR(10)  NOT NULL DEFAULT 'multi',
      required     BOOLEAN      NOT NULL DEFAULT FALSE,
      sort_order   INT          NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS modifier_options (
      id         VARCHAR(36)   NOT NULL PRIMARY KEY,
      group_id   VARCHAR(36)   NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
      name       VARCHAR(255)  NOT NULL,
      price      DECIMAL(10,2) NOT NULL DEFAULT 0,
      available  BOOLEAN       NOT NULL DEFAULT TRUE,
      sort_order INT           NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
      order_item_id      VARCHAR(36)   NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      modifier_option_id VARCHAR(36)   NULL,
      group_name         VARCHAR(255)  NOT NULL,
      option_name        VARCHAR(255)  NOT NULL,
      price              DECIMAL(10,2) NOT NULL DEFAULT 0
    );
  `);

  console.log('✓ Schema ready');
}

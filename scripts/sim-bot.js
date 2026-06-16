#!/usr/bin/env node
/**
 * QRApp Simulation Bot
 * Simulates a real restaurant day with dine-in and takeaway orders.
 *
 * Timing:
 *   New order every ........... 45–120 s  (random)
 *   Pending → Preparing ........ 1–3 min  (staff accepts)
 *   Preparing → Ready .......... 4–8 min  (kitchen cooks)
 *   Ready → Paid/Complete ...... 2–4 min  (customer pays)
 *
 * Usage:  node scripts/sim-bot.js
 *         node scripts/sim-bot.js --fast   (10× faster, good for testing)
 */

const BASE_URL = 'http://localhost:3001';
const CREDENTIALS = { username: 'waiter', password: 'waiter123' };
const FAST_MODE = process.argv.includes('--fast');
const SPEED = FAST_MODE ? 10 : 1;

// ── Timing (all in ms) ─────────────────────────────────────────────────────
const T = {
  orderIntervalMin:  (45 * 1000) / SPEED,
  orderIntervalMax: (120 * 1000) / SPEED,
  acceptMin:          (60 * 1000) / SPEED,
  acceptMax:         (180 * 1000) / SPEED,
  cookMin:           (240 * 1000) / SPEED,
  cookMax:           (480 * 1000) / SPEED,
  payMin:            (120 * 1000) / SPEED,
  payMax:            (240 * 1000) / SPEED,
};

const CUSTOMER_NAMES = [
  'Amal', 'Nimal', 'Kamal', 'Saman', 'Ruwan', 'Dilshan', 'Kasun',
  'Priya', 'Sandya', 'Chamari', 'Niluka', 'Thilini', 'Ayesha',
  'John', 'Sarah', 'Mike', 'Emma', 'James', 'Olivia', 'David',
];

const PAYMENT_METHODS = ['cash', 'cash', 'cash', 'card', 'card'];

// ── Helpers ────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(emoji, msg) {
  const t = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${t}] ${emoji}  ${msg}`);
}

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Order lifecycle ────────────────────────────────────────────────────────

async function progressOrder(order, token) {
  const id = order.id;
  const label = order.orderType === 'takeaway'
    ? `Takeaway #${order.orderNumber} (${order.customerName})`
    : `Table ${order.tableNumber} #${order.orderNumber}`;

  // Pending → Preparing
  await sleep(rand(T.acceptMin, T.acceptMax));
  try {
    await api(`/api/orders/${id}/status`, 'PATCH', { status: 'preparing' }, token);
    log('👨‍🍳', `${label} → Preparing`);
  } catch (e) {
    log('⚠️ ', `${label} status update failed: ${e.message}`);
    return;
  }

  // Preparing → Ready
  await sleep(rand(T.cookMin, T.cookMax));
  try {
    await api(`/api/orders/${id}/status`, 'PATCH', { status: 'ready' }, token);
    log('🔔', `${label} → Ready`);
  } catch (e) {
    log('⚠️ ', `${label} status update failed: ${e.message}`);
    return;
  }

  // Ready → Paid (complete)
  await sleep(rand(T.payMin, T.payMax));
  try {
    const method = pick(PAYMENT_METHODS);
    await api(`/api/orders/${id}/status`, 'PATCH', { status: 'completed', paymentMethod: method }, token);
    log('💰', `${label} → Paid (${method})`);
  } catch (e) {
    // completed may not be a valid status transition — silently skip
  }
}

async function placeOrder(token, menuItems, tables, restaurantId) {
  const isDineIn = Math.random() < 0.6;
  const itemCount = rand(1, 4);
  const chosenItems = [];
  const shuffled = [...menuItems].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(itemCount, shuffled.length); i++) {
    const item = shuffled[i];
    chosenItems.push({
      menuItemId: item.id,
      name: item.name,
      price: parseFloat(item.price),
      quantity: rand(1, 3),
    });
  }

  let body;
  if (isDineIn && tables.length > 0) {
    const table = pick(tables);
    body = {
      orderType: 'dine-in',
      tableId: table.id,
      tableNumber: table.number,
      items: chosenItems,
      restaurantId,
    };
  } else {
    body = {
      orderType: 'takeaway',
      customerName: pick(CUSTOMER_NAMES),
      items: chosenItems,
      restaurantId,
    };
  }

  const order = await api('/api/orders', 'POST', body, token);
  const label = order.orderType === 'takeaway'
    ? `Takeaway #${order.orderNumber} (${order.customerName})`
    : `Table ${order.tableNumber} #${order.orderNumber}`;
  const itemNames = chosenItems.map((i) => `${i.name} ×${i.quantity}`).join(', ');
  log('🛎️ ', `New order — ${label} | ${itemNames}`);

  // Fire-and-forget lifecycle (no await — runs in background)
  progressOrder(order, token).catch(() => {});

  return order;
}

// ── Main loop ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        QRApp Simulation Bot              ║');
  console.log(`║  Mode: ${FAST_MODE ? '⚡ FAST (10×)              ' : '🕐 Normal                 '}║`);
  console.log('║  Press Ctrl+C to stop                    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Login
  log('🔑', 'Logging in...');
  let token, user;
  try {
    const res = await api('/api/auth/login', 'POST', CREDENTIALS);
    token = res.token;
    user = res.user;
    log('✅', `Logged in as ${user.name} (${user.role})`);
  } catch (e) {
    console.error('Login failed:', e.message);
    process.exit(1);
  }

  const restaurantId = user.restaurantId;

  // Fetch menu items
  log('📋', 'Fetching menu...');
  let menuItems = [];
  try {
    menuItems = await api(`/api/menu-items?restaurantId=${restaurantId}`, 'GET', null, token);
    menuItems = menuItems.filter((i) => i.available !== false);
    log('✅', `Found ${menuItems.length} available menu items`);
  } catch (e) {
    console.error('Failed to fetch menu:', e.message);
    process.exit(1);
  }

  if (menuItems.length === 0) {
    console.error('No menu items found. Please seed the menu first.');
    process.exit(1);
  }

  // Fetch tables
  log('🪑', 'Fetching tables...');
  let tables = [];
  try {
    tables = await api('/api/tables', 'GET', null, token);
    tables = tables.filter((t) => t.active !== false);
    log('✅', `Found ${tables.length} active tables`);
  } catch (e) {
    log('⚠️ ', 'Could not fetch tables — takeaway orders only');
  }

  log('🚀', `Starting simulation — new order every ${T.orderIntervalMin / 1000}–${T.orderIntervalMax / 1000}s\n`);

  let orderCount = 0;

  // Place first order immediately
  try {
    await placeOrder(token, menuItems, tables, restaurantId);
    orderCount++;
  } catch (e) {
    log('❌', `Order failed: ${e.message}`);
  }

  // Continuous loop
  while (true) {
    const delay = rand(T.orderIntervalMin, T.orderIntervalMax);
    await sleep(delay);

    try {
      await placeOrder(token, menuItems, tables, restaurantId);
      orderCount++;
    } catch (e) {
      log('❌', `Order failed: ${e.message}`);
      // Re-login if token expired
      if (e.message.includes('401')) {
        try {
          const res = await api('/api/auth/login', 'POST', CREDENTIALS);
          token = res.token;
          log('🔑', 'Re-authenticated');
        } catch {}
      }
    }
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋  Simulation stopped. Bye!\n');
  process.exit(0);
});

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});

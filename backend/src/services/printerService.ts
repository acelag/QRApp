import { pool } from '../db/database';

/* ── Lazy-load so the server starts even if the package is somehow missing ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tp: Record<string, any> | null = null;
function loadLib(): boolean {
  if (tp !== null) return !!tp;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tp = require('node-thermal-printer') as Record<string, any>;
    return true;
  } catch {
    tp = {};
    return false;
  }
}

type PrinterRole = 'receipt' | 'kitchen';
export interface PrintResult { success: boolean; message: string }

interface PrintCfg { ip: string; port: number; printerType: 'epson' | 'star' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePrinter(cfg: PrintCfg): any {
  if (!loadLib() || !tp?.ThermalPrinter) throw new Error('node-thermal-printer is not available on the server');
  return new tp.ThermalPrinter({
    type: cfg.printerType === 'star' ? tp.PrinterTypes?.STAR : tp.PrinterTypes?.EPSON,
    interface: `tcp://${cfg.ip}:${cfg.port}`,
    width: 48,
    characterSet: tp.CharacterSet?.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
  });
}

/* ── DB helpers ─────────────────────────────────────────────────────────── */
async function getRestConfig(restaurantId: string) {
  const result = await pool.query(
    `SELECT name, currency, service_charge_pct, tax_pct,
            receipt_printer_ip, receipt_printer_port,
            kitchen_printer_ip, kitchen_printer_port,
            printer_type, auto_print_kitchen, auto_print_receipt
     FROM restaurants WHERE id = $1`,
    [restaurantId],
  );
  return result.rows.length ? (result.rows[0] as Record<string, unknown>) : null;
}

async function fetchOrderWithItems(orderId: string) {
  const result = await pool.query(
    `SELECT o.*,
       json_agg(
         json_build_object(
           'name',     oi.name,
           'price',    oi.price::float,
           'quantity', oi.quantity,
           'size',     oi.size,
           'notes',    oi.notes,
           'toppings', (
             SELECT COALESCE(
               json_agg(json_build_object('name', oit.name, 'price', oit.price::float) ORDER BY oit.id),
               '[]'::json
             )
             FROM order_item_toppings oit WHERE oit.order_item_id = oi.id
           )
         ) ORDER BY oi.id
       ) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orderId],
  );
  return result.rows.length ? (result.rows[0] as Record<string, unknown>) : null;
}

function getPrinterCfg(rest: Record<string, unknown>, role: PrinterRole): PrintCfg | null {
  const ip   = role === 'kitchen' ? rest.kitchen_printer_ip : rest.receipt_printer_ip;
  const port = Number(role === 'kitchen' ? (rest.kitchen_printer_port ?? 9100) : (rest.receipt_printer_port ?? 9100));
  if (!ip) return null;
  return { ip: ip as string, port, printerType: ((rest.printer_type as string | null) ?? 'epson') as 'epson' | 'star' };
}

/* ── Kitchen ticket ─────────────────────────────────────────────────────── */
export async function printKitchenTicket(restaurantId: string, orderId: string): Promise<PrintResult> {
  const rest = await getRestConfig(restaurantId);
  if (!rest) return { success: false, message: 'Restaurant not found' };
  const cfg = getPrinterCfg(rest, 'kitchen');
  if (!cfg) return { success: false, message: 'Kitchen printer not configured' };

  const order = await fetchOrderWithItems(orderId);
  if (!order) return { success: false, message: 'Order not found' };

  try {
    const printer = makePrinter(cfg);
    const items = (order.items ?? []) as Array<{ name: string; quantity: number; size: string | null; notes: string | null; toppings: Array<{ name: string }> }>;

    printer.alignCenter();
    printer.bold(true);
    printer.println('K I T C H E N');
    printer.bold(false);
    printer.drawLine();

    // Order number
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println(`#${order.order_number ?? (order.id as string).slice(0, 8).toUpperCase()}`);
    printer.bold(false);
    printer.setTextNormal();

    const d = new Date(order.created_at as string);
    printer.println(d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    printer.drawLine();

    // Location
    printer.alignLeft();
    printer.bold(true);
    if (order.order_type === 'room-service') printer.println(`ROOM  ${order.room_number}`);
    else if (order.order_type === 'takeaway') printer.println(`TAKEAWAY${order.customer_name ? `  ${order.customer_name}` : ''}`);
    else printer.println(`TABLE  ${order.table_number}`);
    printer.bold(false);
    printer.drawLine();

    // Items
    for (const item of items) {
      const sizeSuffix = item.size === 'large' ? ' (L)' : item.size === 'regular' ? ' (R)' : '';
      printer.bold(true);
      printer.println(`${item.quantity}x  ${item.name.toUpperCase()}${sizeSuffix}`);
      printer.bold(false);
      for (const t of item.toppings ?? []) printer.println(`    + ${t.name}`);
      if (item.notes) printer.println(`    * ${item.notes}`);
    }

    printer.drawLine();
    printer.alignCenter();
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    printer.println(`${totalQty} item${totalQty !== 1 ? 's' : ''} total`);
    printer.cut();

    await printer.execute();
    printer.clear();
    return { success: true, message: 'Kitchen ticket printed' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Print failed' };
  }
}

/* ── Session receipt (consolidated bill for a table session) ─────────────── */
export async function printSessionReceipt(restaurantId: string, sessionId: string): Promise<PrintResult> {
  const rest = await getRestConfig(restaurantId);
  if (!rest) return { success: false, message: 'Restaurant not found' };
  const cfg = getPrinterCfg(rest, 'receipt');
  if (!cfg) return { success: false, message: 'Receipt printer not configured' };

  // Fetch all items from all orders in this session
  const result = await pool.query(
    `SELECT
       s.id AS session_id,
       s.table_number,
       s.closed_at,
       s.payment_method,
       COALESCE(SUM(DISTINCT o.total_amount), 0)   AS total_amount,
       COALESCE(SUM(DISTINCT o.discount_amount), 0) AS discount_amount,
       json_agg(
         json_build_object(
           'name',     oi.name,
           'price',    oi.price::float,
           'quantity', oi.quantity,
           'size',     oi.size,
           'notes',    oi.notes,
           'toppings', (
             SELECT COALESCE(
               json_agg(json_build_object('name', oit.name, 'price', oit.price::float) ORDER BY oit.id),
               '[]'::json
             ) FROM order_item_toppings oit WHERE oit.order_item_id = oi.id
           )
         ) ORDER BY oi.id
       ) AS items
     FROM sessions s
     JOIN orders o  ON o.session_id = s.id AND o.status != 'cancelled'
     JOIN order_items oi ON oi.order_id = o.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [sessionId],
  );

  if (!result.rows.length) return { success: false, message: 'Session not found or has no orders' };
  const session = result.rows[0] as Record<string, unknown>;

  const items    = (session.items ?? []) as Array<{ name: string; price: number; quantity: number; size: string | null; notes: string | null; toppings: Array<{ name: string; price: number }> }>;
  const scPct    = Number(rest.service_charge_pct ?? 0);
  const taxPct   = Number(rest.tax_pct ?? 0);
  const currency = (rest.currency as string | null) ?? 'USD';
  const subtotal = Number(session.total_amount);
  const discount = Number(session.discount_amount ?? 0);
  const svcCharge = subtotal * (scPct / 100);
  const tax       = (subtotal + svcCharge) * (taxPct / 100);
  const grandTotal = subtotal + svcCharge + tax;
  const f = (n: number) => n.toFixed(2);

  try {
    const printer = makePrinter(cfg);

    printer.alignCenter();
    printer.bold(true);
    printer.println((rest.name as string).toUpperCase());
    printer.bold(false);
    printer.drawLine();
    printer.bold(true);
    printer.println('DINING BILL');
    printer.bold(false);
    printer.drawLine();

    printer.alignLeft();
    const d = new Date((session.closed_at as string | null) ?? new Date().toISOString());
    printer.println(`Date: ${d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}`);
    printer.println(`Time: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    printer.bold(true);
    printer.println(`Table: ${session.table_number}`);
    printer.bold(false);
    printer.drawLine();

    for (const item of items) {
      const toppingsTot = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
      const lineTotal   = (item.price + toppingsTot) * item.quantity;
      const size        = item.size === 'large' ? ' (L)' : item.size === 'regular' ? ' (R)' : '';
      printer.leftRight(`${item.quantity}x ${item.name}${size}`, f(lineTotal));
      for (const t of item.toppings ?? []) {
        if (t.price > 0) printer.leftRight(`   + ${t.name}`, `+${f(t.price)}`);
        else printer.println(`   + ${t.name}`);
      }
      if (item.notes) printer.println(`   (${item.notes})`);
    }
    printer.drawLine();

    if (discount > 0) {
      printer.leftRight('Subtotal', f(subtotal + discount));
      printer.leftRight('Discount', `-${f(discount)}`);
    } else {
      printer.leftRight('Subtotal', f(subtotal));
    }
    if (svcCharge > 0) printer.leftRight(`Service Charge (${scPct}%)`, f(svcCharge));
    if (tax > 0)       printer.leftRight(`Tax (${taxPct}%)`, f(tax));
    printer.drawLine();
    printer.bold(true);
    printer.leftRight(`TOTAL  ${currency}`, f(grandTotal));
    printer.bold(false);

    if (session.payment_method) {
      printer.drawLine();
      const pm = (session.payment_method as string).replace('_', ' ');
      printer.println(`Payment: ${pm.charAt(0).toUpperCase() + pm.slice(1)}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('Thank you for dining with us!');
    printer.println('Please come again  :)');
    printer.cut();

    await printer.execute();
    printer.clear();
    return { success: true, message: 'Receipt printed' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Print failed' };
  }
}

/* ── Receipt ────────────────────────────────────────────────────────────── */
export async function printReceipt(restaurantId: string, orderId: string): Promise<PrintResult> {
  const rest = await getRestConfig(restaurantId);
  if (!rest) return { success: false, message: 'Restaurant not found' };
  const cfg = getPrinterCfg(rest, 'receipt');
  if (!cfg) return { success: false, message: 'Receipt printer not configured' };

  const order = await fetchOrderWithItems(orderId);
  if (!order) return { success: false, message: 'Order not found' };

  const items = (order.items ?? []) as Array<{ name: string; price: number; quantity: number; size: string | null; notes: string | null; toppings: Array<{ name: string; price: number }> }>;
  const scPct     = Number(rest.service_charge_pct ?? 0);
  const taxPct    = Number(rest.tax_pct ?? 0);
  const currency  = (rest.currency as string | null) ?? 'USD';
  const subtotal  = Number(order.total_amount);
  const discount  = Number(order.discount_amount ?? 0);
  const svcCharge = order.order_type === 'dine-in' ? subtotal * (scPct / 100) : 0;
  const tax       = (subtotal + svcCharge) * (taxPct / 100);
  const grandTotal = subtotal + svcCharge + tax;
  const f = (n: number) => n.toFixed(2);

  try {
    const printer = makePrinter(cfg);

    // Header
    printer.alignCenter();
    printer.bold(true);
    printer.println((rest.name as string).toUpperCase());
    printer.bold(false);
    printer.drawLine();

    printer.bold(true);
    if (order.order_type === 'takeaway') printer.println('TAKEAWAY');
    else if (order.order_type === 'room-service') printer.println('ROOM SERVICE');
    else printer.println('DINING BILL');
    printer.bold(false);
    printer.drawLine();

    // Details
    printer.alignLeft();
    const d = new Date(order.created_at as string);
    printer.println(`Date: ${d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}`);
    printer.println(`Time: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    if (order.order_type === 'dine-in' && order.table_number)      printer.println(`Table: ${order.table_number}`);
    else if (order.order_type === 'room-service' && order.room_number) printer.println(`Room: ${order.room_number}`);
    else if (order.customer_name) printer.println(`Name: ${order.customer_name}`);
    if (order.order_number) {
      printer.bold(true);
      printer.println(`Order: #${order.order_number}`);
      printer.bold(false);
    }
    printer.drawLine();

    // Items
    for (const item of items) {
      const toppingsTot = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
      const lineTotal   = (item.price + toppingsTot) * item.quantity;
      const size        = item.size === 'large' ? ' (L)' : item.size === 'regular' ? ' (R)' : '';
      printer.leftRight(`${item.quantity}x ${item.name}${size}`, f(lineTotal));
      for (const t of item.toppings ?? []) {
        if (t.price > 0) printer.leftRight(`   + ${t.name}`, `+${f(t.price)}`);
        else printer.println(`   + ${t.name}`);
      }
      if (item.notes) printer.println(`   (${item.notes})`);
    }
    printer.drawLine();

    // Totals
    if (discount > 0) {
      printer.leftRight('Subtotal', f(subtotal + discount));
      printer.leftRight(`Promo (${(order.promo_code as string | null) ?? ''})`, `-${f(discount)}`);
    } else {
      printer.leftRight('Subtotal', f(subtotal));
    }
    if (svcCharge > 0) printer.leftRight(`Service Charge (${scPct}%)`, f(svcCharge));
    if (tax > 0)       printer.leftRight(`Tax (${taxPct}%)`, f(tax));
    printer.drawLine();
    printer.bold(true);
    printer.leftRight(`TOTAL  ${currency}`, f(grandTotal));
    printer.bold(false);

    if (order.payment_method) {
      printer.drawLine();
      const pm = (order.payment_method as string).replace('_', ' ');
      printer.println(`Payment: ${pm.charAt(0).toUpperCase() + pm.slice(1)}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('Thank you for dining with us!');
    printer.println('Please come again  :)');
    printer.cut();

    await printer.execute();
    printer.clear();
    return { success: true, message: 'Receipt printed' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Print failed' };
  }
}

/* ── Test connection ────────────────────────────────────────────────────── */
export async function testPrinterConnection(restaurantId: string, role: PrinterRole): Promise<PrintResult> {
  const rest = await getRestConfig(restaurantId);
  if (!rest) return { success: false, message: 'Restaurant not found' };
  const cfg = getPrinterCfg(rest, role);
  if (!cfg) return { success: false, message: `${role === 'kitchen' ? 'Kitchen' : 'Receipt'} printer not configured — set the IP first` };

  try {
    const printer = makePrinter(cfg);
    const connected = await printer.isPrinterConnected();
    if (!connected) return { success: false, message: 'Printer unreachable — check IP and port' };

    printer.alignCenter();
    printer.bold(true);
    printer.println('=== TEST PRINT ===');
    printer.bold(false);
    printer.println((rest.name as string));
    printer.println(`${role === 'kitchen' ? 'Kitchen' : 'Receipt'} Printer`);
    printer.drawLine();
    printer.println(new Date().toLocaleString());
    printer.drawLine();
    printer.bold(true);
    printer.println('Connection OK!');
    printer.bold(false);
    printer.cut();

    await printer.execute();
    printer.clear();
    return { success: true, message: 'Test page sent to printer' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Print failed' };
  }
}

/* ── Auto-print helpers (fire-and-forget safe) ──────────────────────────── */
export function autoPrintKitchen(restaurantId: string, orderId: string) {
  getRestConfig(restaurantId).then((rest) => {
    if (rest?.auto_print_kitchen && rest.kitchen_printer_ip) {
      printKitchenTicket(restaurantId, orderId).catch((e) => console.error('[printer] auto kitchen:', e));
    }
  }).catch(() => {});
}

export function autoPrintReceipt(restaurantId: string, orderId: string) {
  getRestConfig(restaurantId).then((rest) => {
    if (rest?.auto_print_receipt && rest.receipt_printer_ip) {
      printReceipt(restaurantId, orderId).catch((e) => console.error('[printer] auto receipt:', e));
    }
  }).catch(() => {});
}

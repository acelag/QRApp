import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const STATUSES = ['booked', 'seated', 'completed', 'cancelled', 'no_show'];

const toReservation = (row: Record<string, unknown>) => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  type: row.type,
  tableId: (row.table_id as string | null) ?? null,
  roomId: (row.room_id as string | null) ?? null,
  // Resolved location label from the LEFT JOINs (null if the table/room was removed)
  tableNumber: row.table_number != null ? Number(row.table_number) : null,
  roomNumber: row.room_number != null ? Number(row.room_number) : null,
  roomName: (row.room_name as string | null) ?? null,
  customerName: row.customer_name,
  customerPhone: (row.customer_phone as string | null) ?? null,
  partySize: Number(row.party_size ?? 1),
  reservedAt: row.reserved_at,
  durationMins: row.duration_mins != null ? Number(row.duration_mins) : null,
  status: row.status,
  notes: (row.notes as string | null) ?? null,
  createdAt: row.created_at,
});

const SELECT = `
  SELECT r.*, t.number AS table_number, rm.number AS room_number, rm.name AS room_name
  FROM reservations r
  LEFT JOIN tables t ON t.id = r.table_id
  LEFT JOIN rooms  rm ON rm.id = r.room_id
`;

// ── List (optional ?date=YYYY-MM-DD and ?status=) ─────────────────────────────
router.get('/', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const { date, status } = req.query as { date?: string; status?: string };
  const params: unknown[] = [req.user!.restaurantId];
  let where = 'WHERE r.restaurant_id = $1';
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    params.push(date);
    // reserved_at is stored as ISO text — cast it to timestamptz for the range compare.
    where += ` AND r.reserved_at::timestamptz >= $${params.length}::timestamptz AND r.reserved_at::timestamptz < ($${params.length}::timestamptz + interval '1 day')`;
  }
  if (status && STATUSES.includes(status)) {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }
  const result = await pool.query(`${SELECT} ${where} ORDER BY r.reserved_at`, params);
  res.json((result.rows as Record<string, unknown>[]).map(toReservation));
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const b = req.body as {
    type?: string; tableId?: string | null; roomId?: string | null;
    customerName?: string; customerPhone?: string | null; partySize?: number;
    reservedAt?: string; durationMins?: number | null; notes?: string | null;
  };
  if (b.type !== 'table' && b.type !== 'room') { res.status(400).json({ error: 'type must be table or room' }); return; }
  if (!b.customerName?.trim()) { res.status(400).json({ error: 'Customer name is required' }); return; }
  if (!b.reservedAt || isNaN(Date.parse(b.reservedAt))) { res.status(400).json({ error: 'A valid date/time is required' }); return; }
  const tableId = b.type === 'table' ? (b.tableId ?? null) : null;
  const roomId  = b.type === 'room'  ? (b.roomId ?? null)  : null;
  if (b.type === 'table' && !tableId) { res.status(400).json({ error: 'Select a table' }); return; }
  if (b.type === 'room' && !roomId)  { res.status(400).json({ error: 'Select a room' }); return; }

  const id = uuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO reservations
       (id, restaurant_id, type, table_id, room_id, customer_name, customer_phone, party_size, reserved_at, duration_mins, status, notes, created_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'booked',$11,$12,$13)`,
    [
      id, req.user!.restaurantId, b.type, tableId, roomId,
      b.customerName.trim(), b.customerPhone?.trim() || null,
      Math.max(1, Math.round(Number(b.partySize) || 1)),
      new Date(b.reservedAt).toISOString(),
      b.durationMins ? Math.max(1, Math.round(b.durationMins)) : null,
      b.notes?.trim() || null, now, req.user!.id,
    ],
  );
  const result = await pool.query(`${SELECT} WHERE r.id = $1`, [id]);
  res.status(201).json(toReservation(result.rows[0] as Record<string, unknown>));
});

// ── Update (status and/or details) ────────────────────────────────────────────
router.patch('/:id', authenticate, requireRole('admin', 'manager', 'cashier', 'waiter'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const owned = await pool.query('SELECT id FROM reservations WHERE id = $1 AND restaurant_id = $2', [id, req.user!.restaurantId]);
  if (!owned.rows.length) { res.status(404).json({ error: 'Not found' }); return; }

  const b = req.body as Record<string, unknown>;
  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (typeof b.status === 'string' && STATUSES.includes(b.status)) set('status', b.status);
  if (typeof b.customerName === 'string' && b.customerName.trim()) set('customer_name', b.customerName.trim());
  if ('customerPhone' in b) set('customer_phone', typeof b.customerPhone === 'string' && b.customerPhone.trim() ? b.customerPhone.trim() : null);
  if (b.partySize != null) set('party_size', Math.max(1, Math.round(Number(b.partySize) || 1)));
  if (typeof b.reservedAt === 'string' && !isNaN(Date.parse(b.reservedAt))) set('reserved_at', new Date(b.reservedAt).toISOString());
  if ('notes' in b) set('notes', typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null);
  if (b.type === 'table') { set('type', 'table'); set('table_id', (b.tableId as string) ?? null); set('room_id', null); }
  if (b.type === 'room')  { set('type', 'room');  set('room_id', (b.roomId as string) ?? null);  set('table_id', null); }

  if (!sets.length) { res.status(400).json({ error: 'No valid fields to update' }); return; }
  params.push(id);
  await pool.query(`UPDATE reservations SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  const result = await pool.query(`${SELECT} WHERE r.id = $1`, [id]);
  res.json(toReservation(result.rows[0] as Record<string, unknown>));
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM reservations WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;

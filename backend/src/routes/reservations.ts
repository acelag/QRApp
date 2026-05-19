import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

type ResStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no-show';

const toRes = (r: Record<string, unknown>) => ({
  id: r.id,
  restaurantId: r.restaurant_id,
  tableId: (r.table_id as string | null) ?? null,
  tableNumber: r.table_number != null ? Number(r.table_number) : null,
  customerName: r.customer_name as string,
  customerPhone: (r.customer_phone as string | null) ?? null,
  partySize: Number(r.party_size),
  date: r.date as string,
  time: r.time as string,
  status: r.status as ResStatus,
  notes: (r.notes as string | null) ?? null,
  createdAt: r.created_at as string,
});

router.get('/', async (req: AuthRequest, res) => {
  const { date } = req.query as { date?: string };
  const rid = req.user!.restaurantId;
  const result = date
    ? await pool.query(
        "SELECT * FROM reservations WHERE restaurant_id = $1 AND date = $2 AND status != 'cancelled' ORDER BY time",
        [rid, date])
    : await pool.query(
        "SELECT * FROM reservations WHERE restaurant_id = $1 AND status != 'cancelled' ORDER BY date, time",
        [rid]);
  res.json((result.rows as Record<string, unknown>[]).map(toRes));
});

router.post('/', async (req: AuthRequest, res) => {
  const { customerName, customerPhone, partySize, date, time, tableId, tableNumber, notes } =
    req.body as { customerName: string; customerPhone?: string; partySize?: number; date: string; time: string; tableId?: string; tableNumber?: number; notes?: string; };
  if (!customerName?.trim() || !date || !time) {
    res.status(400).json({ error: 'customerName, date and time are required' }); return;
  }
  const id = uuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO reservations (id,restaurant_id,table_id,table_number,customer_name,customer_phone,party_size,date,time,status,notes,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
    [id, req.user!.restaurantId, tableId ?? null, tableNumber ?? null, customerName.trim(),
     customerPhone?.trim() || null, partySize ?? 1, date, time, notes?.trim() || null, now],
  );
  const row = await pool.query('SELECT * FROM reservations WHERE id = $1', [id]);
  res.status(201).json(toRes(row.rows[0] as Record<string, unknown>));
});

router.put('/:id', async (req: AuthRequest, res) => {
  const existing = await pool.query('SELECT * FROM reservations WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if (!existing.rows.length) { res.status(404).json({ error: 'Not found' }); return; }
  const r = existing.rows[0] as Record<string, unknown>;
  const { customerName, customerPhone, partySize, date, time, tableId, tableNumber, notes } =
    req.body as { customerName?: string; customerPhone?: string; partySize?: number; date?: string; time?: string; tableId?: string | null; tableNumber?: number | null; notes?: string; };
  await pool.query(
    `UPDATE reservations SET customer_name=$1, customer_phone=$2, party_size=$3, date=$4, time=$5, table_id=$6, table_number=$7, notes=$8 WHERE id=$9`,
    [customerName?.trim() || r.customer_name, customerPhone?.trim() || r.customer_phone,
     partySize ?? r.party_size, date ?? r.date, time ?? r.time,
     tableId !== undefined ? tableId : r.table_id,
     tableNumber !== undefined ? tableNumber : r.table_number,
     notes?.trim() ?? r.notes, req.params.id],
  );
  const row = await pool.query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
  res.json(toRes(row.rows[0] as Record<string, unknown>));
});

router.patch('/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body as { status: ResStatus };
  const valid: ResStatus[] = ['pending', 'confirmed', 'seated', 'cancelled', 'no-show'];
  if (!valid.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
  const result = await pool.query(
    'UPDATE reservations SET status=$1 WHERE id=$2 AND restaurant_id=$3',
    [status, req.params.id, req.user!.restaurantId],
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  const row = await pool.query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
  res.json(toRes(row.rows[0] as Record<string, unknown>));
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const result = await pool.query('DELETE FROM reservations WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user!.restaurantId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;

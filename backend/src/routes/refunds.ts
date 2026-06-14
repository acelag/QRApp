import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { recordAudit, auditFromReq } from '../lib/audit';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin', 'manager'));

// GET /api/refunds?limit=100&offset=0
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId } = req.user!;
    const limit  = Math.min(Number(req.query.limit)  || 100, 500);
    const offset = Number(req.query.offset) || 0;

    const { rows } = await pool.query(
      `SELECT id, order_id, session_id, amount, reason, refund_method,
              created_by, created_by_name, created_at
       FROM   refunds
       WHERE  restaurant_id = $1
       ORDER  BY created_at DESC
       LIMIT  $2 OFFSET $3`,
      [restaurantId, limit, offset],
    );

    res.json(rows.map((r) => ({
      id:            r.id,
      orderId:       r.order_id,
      sessionId:     r.session_id,
      amount:        Number(r.amount),
      reason:        r.reason,
      refundMethod:  r.refund_method,
      createdBy:     r.created_by,
      createdByName: r.created_by_name,
      createdAt:     r.created_at,
    })));
  } catch (err) { next(err); }
});

// POST /api/refunds
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId, id: userId, name: userName } = req.user!;
    const { orderId, sessionId, amount, reason, refundMethod } = req.body as {
      orderId?:     string;
      sessionId?:   string;
      amount:       number;
      reason:       string;
      refundMethod: string;
    };

    if (!amount || Number(amount) <= 0)
      return void res.status(400).json({ error: 'amount must be greater than zero' });
    if (!reason?.trim())
      return void res.status(400).json({ error: 'reason is required' });
    if (!refundMethod?.trim())
      return void res.status(400).json({ error: 'refundMethod is required' });
    if (!orderId && !sessionId)
      return void res.status(400).json({ error: 'orderId or sessionId is required' });

    // Verify ownership
    if (orderId) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM orders WHERE id = $1 AND restaurant_id = $2`,
        [orderId, restaurantId],
      );
      if (!rowCount) return void res.status(404).json({ error: 'Order not found' });
    } else if (sessionId) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM table_sessions WHERE id = $1 AND restaurant_id = $2`,
        [sessionId, restaurantId],
      );
      if (!rowCount) return void res.status(404).json({ error: 'Session not found' });
    }

    const id  = uuidv4();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO refunds
         (id, restaurant_id, order_id, session_id, amount, reason,
          refund_method, created_by, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, restaurantId, orderId ?? null, sessionId ?? null,
       Number(amount), reason.trim(), refundMethod,
       userId, userName ?? 'Staff', now],
    );

    void recordAudit(auditFromReq(req, 'refund.create', {
      entityType: 'refund', entityId: id,
      summary: `Refund ${Number(amount).toFixed(2)} via ${refundMethod} — ${reason.trim()}${orderId ? ` (order ${orderId.slice(0, 8)})` : ''}`,
    }));

    res.status(201).json({
      id,
      orderId:       orderId   ?? null,
      sessionId:     sessionId ?? null,
      amount:        Number(amount),
      reason:        reason.trim(),
      refundMethod,
      createdBy:     userId,
      createdByName: userName ?? 'Staff',
      createdAt:     now,
    });
  } catch (err) { next(err); }
});

export default router;

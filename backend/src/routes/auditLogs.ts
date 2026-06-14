import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const toLog = (r: Record<string, unknown>) => ({
  id:             String(r.id),
  restaurantId:   r.restaurant_id ?? null,
  restaurantName: r.restaurant_name ?? null,
  userId:         r.user_id ?? null,
  userName:       r.user_name ?? '',
  userRole:       r.user_role ?? '',
  action:         r.action,
  entityType:     r.entity_type ?? null,
  entityId:       r.entity_id ?? null,
  summary:        r.summary ?? '',
  ip:             r.ip ?? null,
  createdAt:      r.created_at,
});

// GET /api/audit-logs — filterable, paginated activity trail
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId, action, q, from, to } = req.query as Record<string, string | undefined>;
    const limit  = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const where: string[] = [];
    const params: unknown[] = [];
    if (restaurantId) { params.push(restaurantId); where.push(`a.restaurant_id = $${params.length}`); }
    if (action)       { params.push(`${action}%`); where.push(`a.action LIKE $${params.length}`); }
    if (from)         { params.push(from);          where.push(`a.created_at >= $${params.length}`); }
    if (to)           { params.push(to);            where.push(`a.created_at <= $${params.length}`); }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(LOWER(a.summary) LIKE $${params.length} OR LOWER(a.user_name) LIKE $${params.length} OR LOWER(a.action) LIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit);  const limIdx = params.length;
    params.push(offset); const offIdx = params.length;

    const { rows } = await pool.query(
      `SELECT a.*, r.name AS restaurant_name
         FROM audit_logs a
         LEFT JOIN restaurants r ON r.id = a.restaurant_id
         ${whereSql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params,
    );
    res.json(rows.map(toLog));
  } catch (err) { next(err); }
});

export default router;

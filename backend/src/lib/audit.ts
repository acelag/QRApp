import { pool } from '../db/database';
import type { AuthRequest } from '../middleware/auth';

export interface AuditEntry {
  restaurantId?: string | null;
  userId?: string | null;
  userName?: string;
  userRole?: string;
  /** Dot-namespaced action, e.g. 'auth.login', 'user.create', 'order.cancel'. */
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string;
  ip?: string | null;
}

/**
 * Persist an audit-log row. Fire-and-forget: failures are logged but never
 * propagate, so auditing can't break the action being recorded.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (restaurant_id, user_id, user_name, user_role, action, entity_type, entity_id, summary, ip, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.restaurantId ?? null,
        entry.userId ?? null,
        entry.userName ?? '',
        entry.userRole ?? '',
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        (entry.summary ?? '').slice(0, 500),
        entry.ip ?? null,
        new Date().toISOString(),
      ],
    );
  } catch (e) {
    console.error('[audit] failed to record', entry.action, (e as Error).message);
  }
}

/** Extract the best-effort client IP from a request. */
export function clientIp(req: AuthRequest): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first?.trim() || req.socket?.remoteAddress || null) ?? null;
}

/** Build an audit entry from an authenticated request, merging in overrides. */
export function auditFromReq(req: AuthRequest, action: string, extra: Partial<AuditEntry> = {}): AuditEntry {
  return {
    restaurantId: req.user?.restaurantId ?? null,
    userId:       req.user?.id ?? null,
    userName:     req.user?.name ?? '',
    userRole:     req.user?.role ?? '',
    action,
    ip:           clientIp(req),
    ...extra,
  };
}

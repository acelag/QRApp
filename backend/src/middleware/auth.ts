import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'qra-super-secret-change-in-production';

export interface AuthPayload {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
  restaurantId: string | null;  // null for super_admin
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'No token — please log in' }); return; }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Reads JWT if present, but never blocks the request (for public+admin dual-use routes). */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET) as AuthPayload; } catch { /* ignore */ }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(403).json({ error: 'Access denied' }); return; }
    // super_admin bypasses all role restrictions
    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      next(); return;
    }
    res.status(403).json({ error: 'Access denied' });
  };
}

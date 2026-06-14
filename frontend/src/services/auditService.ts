import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/audit-logs`;

export interface AuditLog {
  id: string;
  restaurantId: string | null;
  restaurantName: string | null;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ip: string | null;
  createdAt: string;
}

export interface AuditFilter {
  restaurantId?: string;
  action?: string;   // action prefix, e.g. 'auth', 'user', 'menu'
  q?: string;
  from?: string;     // ISO datetime lower bound
  to?: string;       // ISO datetime upper bound
  limit?: number;
  offset?: number;
}

export const auditService = {
  list: (filter: AuditFilter = {}) =>
    axios.get<AuditLog[]>(BASE, { params: filter }).then((r) => r.data),
};

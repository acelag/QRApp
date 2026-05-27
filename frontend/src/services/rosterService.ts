import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/roster`;

export type ShiftStatus = 'scheduled' | 'confirmed' | 'absent' | 'completed';

export interface Shift {
  id: string;
  userId: string | null;
  staffName: string;
  staffRole: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  notes: string | null;
  status: ShiftStatus;
  createdAt: string;
}

export interface ShiftInput {
  userId?: string | null;
  staffName: string;
  staffRole: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  status?: ShiftStatus;
}

export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:   { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  manager: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200'   },
  cashier: { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200'  },
  waiter:  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  kitchen: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200'    },
  staff:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200'   },
};

export function roleColor(role: string) {
  return ROLE_COLORS[role] ?? ROLE_COLORS.staff;
}

export const STATUS_CFG: Record<ShiftStatus, { dot: string; label: string }> = {
  scheduled: { dot: 'bg-gray-400',  label: 'Scheduled' },
  confirmed: { dot: 'bg-green-500', label: 'Confirmed' },
  absent:    { dot: 'bg-red-500',   label: 'Absent'    },
  completed: { dot: 'bg-blue-400',  label: 'Completed' },
};

export const SHIFT_ROLES = ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'staff'] as const;

export const rosterService = {
  getShifts: (from: string, to: string): Promise<Shift[]> =>
    axios.get<Shift[]>(`${BASE}?from=${from}&to=${to}`).then((r) => r.data),

  createShift: (data: ShiftInput): Promise<Shift> =>
    axios.post<Shift>(BASE, data).then((r) => r.data),

  updateShift: (id: string, data: ShiftInput): Promise<Shift> =>
    axios.put<Shift>(`${BASE}/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: ShiftStatus): Promise<Shift> =>
    axios.patch<Shift>(`${BASE}/${id}/status`, { status }).then((r) => r.data),

  deleteShift: (id: string): Promise<void> =>
    axios.delete(`${BASE}/${id}`).then(() => {}),
};

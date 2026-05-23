import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/menu-schedules`;

export interface MenuSchedule {
  id: string;
  name: string;
  /** 'daily' | 'weekdays' | 'weekends' | comma-sep JS getDay() values e.g. '1,2,3' */
  days: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  active: boolean;
  createdAt: string;
  itemCount: number;
}

export type ScheduleInput = Pick<MenuSchedule, 'name' | 'days' | 'startTime' | 'endTime' | 'active'>;

/** Short day labels in JS getDay() order (0 = Sun … 6 = Sat). */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Parse a days string into an array of JS day numbers (0 = Sun … 6 = Sat). */
export function parseDays(days: string): number[] {
  if (days === 'daily')    return [0, 1, 2, 3, 4, 5, 6];
  if (days === 'weekdays') return [1, 2, 3, 4, 5];
  if (days === 'weekends') return [0, 6];
  return days.split(',').map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 6);
}

/** Human-readable days label. */
export function formatDays(days: string): string {
  if (days === 'daily')    return 'Every day';
  if (days === 'weekdays') return 'Mon – Fri';
  if (days === 'weekends') return 'Sat & Sun';
  const nums = parseDays(days);
  if (nums.length === 7) return 'Every day';
  if (nums.length === 0) return 'No days';
  return nums.map((n) => DAY_LABELS[n]).join(', ');
}

/** Returns true if the given schedule is currently active based on the client's local time. */
export function isScheduleNowActive(s: MenuSchedule): boolean {
  if (!s.active) return false;
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun … 6=Sat
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (!parseDays(s.days).includes(day)) return false;
  // Handle overnight schedules (e.g. 22:00 – 02:00)
  if (s.startTime <= s.endTime) return hhmm >= s.startTime && hhmm <= s.endTime;
  return hhmm >= s.startTime || hhmm <= s.endTime;
}

export const menuScheduleService = {
  /** Public endpoint — pass restaurantId for customer menus, omit for authenticated admin. */
  getSchedules: (restaurantId?: string): Promise<MenuSchedule[]> =>
    axios
      .get<MenuSchedule[]>(BASE, { params: restaurantId ? { restaurantId } : undefined })
      .then((r) => r.data),

  createSchedule: (data: ScheduleInput): Promise<MenuSchedule> =>
    axios.post<MenuSchedule>(BASE, data).then((r) => r.data),

  updateSchedule: (id: string, data: ScheduleInput): Promise<MenuSchedule> =>
    axios.put<MenuSchedule>(`${BASE}/${id}`, data).then((r) => r.data),

  setActive: (id: string, active: boolean): Promise<{ id: string; active: boolean }> =>
    axios.patch(`${BASE}/${id}/active`, { active }).then((r) => r.data),

  deleteSchedule: (id: string): Promise<void> =>
    axios.delete(`${BASE}/${id}`).then(() => {}),
};

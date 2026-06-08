import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
  restaurantId: string | null;
  permissions?: string[];
}

export interface RestaurantFeatures {
  combos: boolean;
  menuSchedules: boolean;
  roomCharges: boolean;
  promoCodes: boolean;
  reports: boolean;
  roster: boolean;
  shiftReport: boolean;
  staffPerformance: boolean;
  tableStatus: boolean;
  readyDisplay: boolean;
  kitchenDisplay: boolean;
  bills: boolean;
}

export const ALL_FEATURES_ON: RestaurantFeatures = {
  combos: true, menuSchedules: true, roomCharges: true, promoCodes: true,
  reports: true, roster: true, shiftReport: true, staffPerformance: true,
  tableStatus: true, readyDisplay: true, kitchenDisplay: true, bills: true,
};

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  features: RestaurantFeatures;
  refreshFeatures: () => Promise<void>;
  /** admin & super_admin always true; staff true only if explicitly granted. */
  hasPermission: (key: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (payload: {
    restaurantName: string;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
    plan: string;
  }) => Promise<void>;
  logout: () => void;
  updateProfile: (payload: {
    currentPassword: string;
    newUsername?: string;
    newName?: string;
    newPassword?: string;
  }) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'qra_token';

async function fetchFeatures(restaurantId: string): Promise<RestaurantFeatures> {
  try {
    const res = await axios.get<{ features: RestaurantFeatures }>(`/api/restaurants/${restaurantId}`);
    return res.data.features ?? ALL_FEATURES_ON;
  } catch {
    return ALL_FEATURES_ON;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [features, setFeatures] = useState<RestaurantFeatures>(ALL_FEATURES_ON);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
      axios.get<AuthUser>('/api/auth/me', { timeout: 10000 })
        .then(async (res) => {
          setToken(stored);
          setUser(res.data);
          if (res.data.restaurantId) {
            const f = await fetchFeatures(res.data.restaurantId);
            setFeatures(f);
          }
        })
        .catch(() => { localStorage.removeItem(TOKEN_KEY); delete axios.defaults.headers.common['Authorization']; })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshFeatures = useCallback(async () => {
    if (user?.restaurantId) {
      const f = await fetchFeatures(user.restaurantId);
      setFeatures(f);
    }
  }, [user]);

  const hasPermission = useCallback((key: string) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return (user.permissions ?? []).includes(key);
  }, [user]);

  // Re-fetch the live user record (fresh role + permissions) so admin changes
  // apply without requiring the staff member to log out and back in.
  const refreshSession = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const res = await axios.get<AuthUser>('/api/auth/me', { timeout: 10000 });
      setUser((prev) => {
        if (!prev) return res.data;
        const next = res.data.permissions ?? [];
        const samePerms = (prev.permissions ?? []).length === next.length
          && (prev.permissions ?? []).every((p, i) => p === next[i]);
        if (samePerms && prev.role === res.data.role) return prev; // no change → no re-render
        return { ...prev, role: res.data.role, permissions: next };
      });
    } catch (e: unknown) {
      // Token invalid or user removed → sign out cleanly.
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
        setFeatures(ALL_FEATURES_ON);
      }
    }
  }, []);

  // Poll for live permission/role changes while signed in (on focus + interval).
  useEffect(() => {
    if (!token) return;
    const onFocus = () => refreshSession();
    window.addEventListener('focus', onFocus);
    const id = setInterval(refreshSession, 60_000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
  }, [token, refreshSession]);

  async function login(username: string, password: string) {
    const res = await axios.post<{ token: string; user: AuthUser }>('/api/auth/login', { username, password });
    await applyToken(res.data.token, res.data.user);
  }

  async function signup(payload: {
    restaurantName: string;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
    plan: string;
  }) {
    const res = await axios.post<{ token: string; user: AuthUser }>('/api/subscription/signup', payload);
    await applyToken(res.data.token, res.data.user);
  }

  async function updateProfile(payload: {
    currentPassword: string;
    newUsername?: string;
    newName?: string;
    newPassword?: string;
  }) {
    const res = await axios.patch<{ token: string; user: AuthUser }>('/api/auth/profile', payload);
    await applyToken(res.data.token, res.data.user);
  }

  async function applyToken(t: string, u: AuthUser) {
    localStorage.setItem(TOKEN_KEY, t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
    if (u.restaurantId) {
      const f = await fetchFeatures(u.restaurantId);
      setFeatures(f);
    } else {
      // super_admin — all features on
      setFeatures(ALL_FEATURES_ON);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setFeatures(ALL_FEATURES_ON);
  }

  return (
    <AuthContext.Provider value={{ user, token, features, refreshFeatures, hasPermission, login, signup, logout, updateProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

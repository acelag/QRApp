import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
  restaurantId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
      axios.get<AuthUser>('/api/auth/me', { timeout: 10000 })
        .then((res) => { setToken(stored); setUser(res.data); })
        .catch(() => { localStorage.removeItem(TOKEN_KEY); delete axios.defaults.headers.common['Authorization']; })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const res = await axios.post<{ token: string; user: AuthUser }>('/api/auth/login', { username, password });
    applyToken(res.data.token, res.data.user);
  }

  async function updateProfile(payload: {
    currentPassword: string;
    newUsername?: string;
    newName?: string;
    newPassword?: string;
  }) {
    const res = await axios.patch<{ token: string; user: AuthUser }>('/api/auth/profile', payload);
    applyToken(res.data.token, res.data.user);
  }

  function applyToken(t: string, u: AuthUser) {
    localStorage.setItem(TOKEN_KEY, t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

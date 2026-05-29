import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEV_CREDENTIALS = [
  { label: 'Super Admin', color: 'purple', u: 'superadmin', p: 'super123'   },
  { label: 'Admin',       color: 'orange', u: 'admin',      p: 'admin123'   },
  { label: 'Manager',     color: 'violet', u: 'manager',    p: 'manager123' },
  { label: 'Cashier',     color: 'green',  u: 'cashier',    p: 'cashier123' },
  { label: 'Waiter',      color: 'blue',   u: 'waiter',     p: 'waiter123'  },
  { label: 'Kitchen',     color: 'rose',   u: 'kitchen',    p: 'kitchen123' },
] as const;

const COLOR_CLS: Record<string, { bg: string; border: string; hover: string; text: string; mono: string }> = {
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', hover: 'hover:bg-purple-100', text: 'text-purple-700', mono: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-100', hover: 'hover:bg-orange-100', text: 'text-orange-700', mono: 'text-orange-600' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-100', hover: 'hover:bg-violet-100', text: 'text-violet-700', mono: 'text-violet-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-100',  hover: 'hover:bg-green-100',  text: 'text-green-700',  mono: 'text-green-600'  },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   hover: 'hover:bg-blue-100',   text: 'text-blue-700',   mono: 'text-blue-600'   },
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-100',   hover: 'hover:bg-rose-100',   text: 'text-rose-700',   mono: 'text-rose-600'   },
};

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { clearTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => { clearTheme(); }, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slowRequest, setSlowRequest] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setSlowRequest(false);
    setLoading(true);
    const slowTimer = setTimeout(() => setSlowRequest(true), 5000);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true }); // RootRedirect handles role-based routing
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('auth.loginFailed'));
    } finally {
      clearTimeout(slowTimer);
      setSlowRequest(false);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <UtensilsCrossed size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.appName')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('auth.signInTo')}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.username')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder={t('auth.usernamePlaceholder')}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>

            {slowRequest && (
              <p className="text-center text-xs text-amber-600 animate-pulse">
                Server is warming up, please wait…
              </p>
            )}
          </form>
        </div>

        {/* Default credentials — dev only, never shown in production build */}
        {import.meta.env.DEV && (
          <div className="mt-4 bg-white/70 rounded-2xl border border-gray-100 px-4 py-3 text-xs text-gray-500 space-y-1.5">
            <p className="font-medium text-gray-600 mb-2">
              Default credentials <span className="text-orange-400">(dev only)</span>
            </p>
            {DEV_CREDENTIALS.map(({ label, color, u, p }) => {
              const c = COLOR_CLS[color];
              return (
                <div
                  key={u}
                  className={`flex items-center justify-between gap-2 ${c.bg} border ${c.border} rounded-xl px-3 py-2 cursor-pointer ${c.hover} transition-colors`}
                  onClick={() => { setUsername(u); setPassword(p); }}
                >
                  <span className={`font-medium ${c.text}`}>{label}</span>
                  <span className={`font-mono ${c.mono}`}>{u} / {p}</span>
                </div>
              );
            })}
            <p className="text-center text-gray-400 pt-1">Click any row to auto-fill</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true }); // RootRedirect handles role-based routing
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Login failed. Please try again.');
    } finally {
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
          <h1 className="text-2xl font-bold text-gray-900">QRA System</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder="Enter your username"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Default credentials — dev only, never shown in production build */}
        {import.meta.env.DEV && (
          <div className="mt-4 bg-white/70 rounded-2xl border border-gray-100 px-4 py-3 text-xs text-gray-500 space-y-1.5">
            <p className="font-medium text-gray-600 mb-2">Default credentials <span className="text-orange-400">(dev only)</span></p>
            <div
              className="flex items-center justify-between gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => { setUsername('superadmin'); setPassword('super123'); }}
            >
              <span>🛡️ <span className="font-medium text-purple-700">Super Admin</span></span>
              <span className="font-mono text-purple-600">superadmin / super123</span>
            </div>
            <div
              className="flex items-center justify-between gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 cursor-pointer hover:bg-orange-100 transition-colors"
              onClick={() => { setUsername('admin'); setPassword('admin123'); }}
            >
              <span>🧑‍💼 <span className="font-medium text-orange-700">Admin</span></span>
              <span className="font-mono text-orange-600">admin / admin123</span>
            </div>
            <div
              className="flex items-center justify-between gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => { setUsername('kitchen'); setPassword('kitchen123'); }}
            >
              <span>👨‍🍳 <span className="font-medium text-green-700">Kitchen</span></span>
              <span className="font-mono text-green-600">kitchen / kitchen123</span>
            </div>
            <p className="text-center text-gray-400 pt-1">Click any row to auto-fill</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { THEME_COLOR } from '../context/ThemeContext';
import { restaurantService, type LoginBranding } from '../services/restaurantService';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();

  // ── Per-restaurant branding (when reached via /login/:slug) ──────────────────
  const [branding, setBranding] = useState<LoginBranding | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  // App-wide login icon (stored in the database, base64 data URL)
  const [loginIcon, setLoginIcon] = useState<string | null>(null);
  useEffect(() => {
    restaurantService.getAppSettings().then((s) => setLoginIcon(s.loginIcon)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) { setBranding(null); return; }
    restaurantService.getBrandingBySlug(slug).then(setBranding).catch(() => setBranding(null));
  }, [slug]);

  // Auto-rotate the image slider every 5s (only when there are 2+ images and no video)
  useEffect(() => {
    const imgs = branding?.loginMedia ?? [];
    if (branding?.loginVideoUrl || imgs.length < 2) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % imgs.length), 5000);
    return () => clearInterval(id);
  }, [branding]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slowRequest, setSlowRequest] = useState(false);

  async function doLogin(u: string, p: string) {
    if (!u.trim() || !p) return;
    setError('');
    setSlowRequest(false);
    setLoading(true);
    const slowTimer = setTimeout(() => setSlowRequest(true), 5000);
    try {
      await login(u.trim(), p);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin(username, password);
  }

  // Prefill (and optionally auto-submit) when arriving from a demo role tile.
  useEffect(() => {
    const st = location.state as { u?: string; p?: string; auto?: boolean } | null;
    if (st?.u) {
      setUsername(st.u);
      setPassword(st.p ?? '');
      if (st.auto && st.p) doLogin(st.u, st.p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = THEME_COLOR;
  const images = branding?.loginMedia ?? [];
  const hasMedia = !!branding && (!!branding.loginVideoUrl || images.length > 0);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50">
      {/* ── Branded background (video or image slider) ── */}
      {hasMedia && (
        <div className="absolute inset-0 z-0">
          {branding!.loginVideoUrl ? (
            <video
              className="w-full h-full object-cover"
              src={branding!.loginVideoUrl}
              autoPlay loop muted playsInline
            />
          ) : (
            images.map((src, i) => (
              <div
                key={src + i}
                className="absolute inset-0 bg-center bg-cover transition-opacity duration-1000"
                style={{ backgroundImage: `url(${src})`, opacity: i === slideIdx ? 1 : 0 }}
              />
            ))
          )}
          {/* Readability scrim */}
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          {branding?.logo ? (
            <img src={branding.logo} alt={branding.name}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl object-cover shadow-lg bg-white" />
          ) : !branding && loginIcon ? (
            // Default app login — main app icon (stored in the database)
            <img src={loginIcon} alt="OrderLive"
              className="w-24 h-24 mx-auto mb-4 object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ backgroundColor: theme }}>
              <UtensilsCrossed size={32} className="text-white" />
            </div>
          )}
          <h1 className={`text-2xl font-bold ${hasMedia ? 'text-white drop-shadow' : 'text-gray-900'}`}>
            {branding?.name ?? t('auth.appName')}
          </h1>
          <p className={`text-sm mt-1 ${hasMedia ? 'text-white/80' : 'text-gray-500'}`}>{t('auth.signInTo')}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
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
              style={branding ? { backgroundColor: theme } : undefined}
              className={`w-full text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2 ${branding ? 'hover:opacity-90' : 'bg-orange-500 hover:bg-orange-600'}`}
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

      </div>
    </div>
  );
}

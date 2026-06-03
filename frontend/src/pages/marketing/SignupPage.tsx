import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { QrCode, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { PlanCode } from '../../services/subscriptionService';

const PLAN_LABELS: Record<PlanCode, string> = { free: 'Free', starter: 'Starter', pro: 'Pro' };
const isPlan = (v: string | null): v is PlanCode => v === 'free' || v === 'starter' || v === 'pro';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPlan = isPlan(params.get('plan')) ? (params.get('plan') as PlanCode) : 'starter';

  const [restaurantName, setRestaurantName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<PlanCode>(initialPlan);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!restaurantName.trim() || !email.trim() || !password) { setError('Please fill in all required fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await signup({ restaurantName: restaurantName.trim(), adminName: adminName.trim(), adminUsername: email.trim(), adminPassword: password, plan });
      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-gray-50 focus:bg-white transition-colors';

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="flex items-center gap-2 font-extrabold text-gray-900 text-xl mb-6">
        <span className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center"><QrCode size={20} /></span>
        QRApp
      </Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-7">
        <h1 className="text-2xl font-bold text-gray-900">Start your free trial</h1>
        <p className="text-sm text-gray-500 mt-1">14 days free · no credit card required</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Restaurant name *</label>
            <input className={input} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="e.g. The Spice Garden" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Your name</label>
            <input className={input} value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Owner / manager name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Email *</label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" />
            <p className="text-xs text-gray-400 mt-1">You'll use this to log in.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Password *</label>
            <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'starter', 'pro'] as PlanCode[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${plan === p ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {PLAN_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Create account & start trial
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          Already have an account? <Link to="/login" className="text-orange-500 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Stand-in for a real payment gateway (PayHere etc.). Lets you exercise the
 * full subscribe → activate flow while BILLING_PROVIDER=mock. The real gateway
 * will replace this with its own hosted checkout; nothing else changes.
 */
export function MockCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshFeatures } = useAuth();
  const [processing, setProcessing] = useState(false);

  const restaurantId = params.get('restaurantId') ?? '';
  const plan = params.get('plan') ?? 'starter';
  const email = params.get('email') ?? '';
  const returnUrl = params.get('return') ?? '/admin/settings';

  async function pay() {
    setProcessing(true);
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await axios.post('/api/subscription/webhook', {
        type: 'activated',
        restaurantId,
        planCode: plan,
        periodEnd,
        externalId: `mock_${restaurantId}_${plan}_${Date.now()}`,
        customerId: `mockcust_${restaurantId}`,
      });
      await refreshFeatures().catch(() => {});
      navigate(returnUrl, { replace: true });
    } catch {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center gap-2">
          <CreditCard size={18} />
          <span className="font-semibold">Secure checkout</span>
          <span className="ml-auto text-xs bg-amber-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">SANDBOX</span>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">This is a sandbox checkout for testing. No real payment is taken.</p>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-semibold capitalize">{plan}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Billing email</span><span className="font-medium">{email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Billing cycle</span><span className="font-medium">Monthly</span></div>
          </div>
          <button
            onClick={pay}
            disabled={processing || !restaurantId}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {processing ? 'Processing…' : 'Simulate successful payment'}
          </button>
          <button onClick={() => navigate(returnUrl)} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionService, daysUntil, type MySubscription } from '../services/subscriptionService';

/**
 * Shows a subscription nudge when the restaurant is on a trial or has a
 * billing problem. Hidden for healthy active subscriptions and super_admins.
 */
export function TrialBanner() {
  const { user } = useAuth();
  const [sub, setSub] = useState<MySubscription | null>(null);

  useEffect(() => {
    if (!user?.restaurantId) return;
    subscriptionService.getMine().then(setSub).catch(() => {});
  }, [user?.restaurantId]);

  if (!sub) return null;
  if (sub.status === 'active') return null;

  let tone = 'bg-blue-50 border-blue-200 text-blue-800';
  let Icon = Clock;
  let message = '';
  if (sub.status === 'trialing') {
    const d = daysUntil(sub.trialEndsAt);
    message = `You're on the ${sub.planName} free trial — ${d} day${d === 1 ? '' : 's'} left.`;
  } else if (sub.status === 'past_due') {
    tone = 'bg-amber-50 border-amber-200 text-amber-800';
    Icon = AlertTriangle;
    message = 'Your last payment failed. Update billing to keep your features.';
  } else if (sub.status === 'canceled') {
    tone = 'bg-red-50 border-red-200 text-red-700';
    Icon = AlertTriangle;
    message = 'Your subscription is canceled. Choose a plan to reactivate.';
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <Icon size={18} className="shrink-0" />
      <span className="flex-1 font-medium">{message}</span>
      <Link to="/admin/billing" className="shrink-0 inline-flex items-center gap-1 font-semibold hover:underline">
        {sub.status === 'trialing' ? 'Upgrade' : 'Manage billing'} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

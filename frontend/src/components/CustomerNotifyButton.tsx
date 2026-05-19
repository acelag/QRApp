import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { customerPushService } from '../services/customerPushService';

interface Props {
  orderId: string;
}

type State = 'unsupported' | 'denied' | 'loading' | 'subscribed' | 'unsubscribed';

export function CustomerNotifyButton({ orderId }: Props) {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!customerPushService.isSupported()) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    setState(customerPushService.isSubscribed(orderId) ? 'subscribed' : 'unsubscribed');
  }, [orderId]);

  async function toggle() {
    if (state === 'subscribed') {
      setState('loading');
      try {
        await customerPushService.unsubscribe(orderId);
        setState('unsubscribed');
      } catch {
        setState('subscribed');
      }
      return;
    }

    setState('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState('denied'); return; }
      await customerPushService.subscribe(orderId);
      setState('subscribed');
    } catch {
      setState('unsubscribed');
    }
  }

  if (state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
        <BellOff size={14} />
        <span>Notifications blocked — enable them in browser settings</span>
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={state === 'loading'}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-colors ${
        state === 'subscribed'
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
      } disabled:opacity-50`}
    >
      {state === 'loading' ? (
        <Loader2 size={16} className="animate-spin" />
      ) : state === 'subscribed' ? (
        <BellRing size={16} />
      ) : (
        <Bell size={16} />
      )}
      {state === 'loading'
        ? 'Setting up…'
        : state === 'subscribed'
        ? 'Notifications On — tap to turn off'
        : 'Notify me when order is ready'}
    </button>
  );
}

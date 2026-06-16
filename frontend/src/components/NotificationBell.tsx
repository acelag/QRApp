import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { pushService } from '../services/pushService';
import toast from 'react-hot-toast';

type State = 'unsupported' | 'denied' | 'loading' | 'off' | 'on';

interface Props {
  /** Use 'dark' on the dark kitchen page, 'light' (default) everywhere else */
  theme?: 'light' | 'dark';
}

export function NotificationBell({ theme = 'light' }: Props) {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!pushService.isSupported()) { setState('unsupported'); return; }
    if (pushService.permissionState() === 'denied') { setState('denied'); return; }

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    Promise.race([pushService.getSubscription(), timeout])
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  async function toggle() {
    if (state === 'on') {
      setState('loading');
      try {
        await pushService.unsubscribe();
        setState('off');
        toast.success('Notifications disabled');
      } catch {
        toast.error('Failed to disable notifications');
        setState('on');
      }
      return;
    }

    if (state === 'off') {
      setState('loading');
      try {
        await pushService.subscribe();
        setState('on');
        toast.success('Notifications enabled!');
      } catch (err: unknown) {
        const msg = (err as Error).message ?? '';
        if (msg.includes('denied')) {
          setState('denied');
          toast.error('Permission denied — enable in browser settings');
        } else {
          toast.error('Failed to enable notifications');
          setState('off');
        }
      }
    }
  }

  // Colour tokens for each theme
  const base   = theme === 'dark'
    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100';
  const active = theme === 'dark'
    ? 'text-orange-400 hover:text-orange-300 hover:bg-gray-700'
    : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50';

  if (state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <span title="Notifications blocked — change in browser settings"
        className={`p-1.5 rounded-lg cursor-not-allowed opacity-40 ${base}`}>
        <BellOff size={18} />
      </span>
    );
  }

  if (state === 'loading') {
    return (
      <span className={`p-1.5 rounded-lg ${base}`}>
        <Loader2 size={18} className="animate-spin" />
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      title={state === 'on' ? 'Notifications ON — click to disable' : 'Enable push notifications'}
      className={`p-1.5 rounded-lg transition-colors ${state === 'on' ? active : base}`}
    >
      {state === 'on' ? <BellRing size={18} /> : <Bell size={18} />}
    </button>
  );
}

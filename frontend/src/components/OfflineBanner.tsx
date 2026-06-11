import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { offlineQueue } from '../services/offlineQueue';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [count, setCount] = useState(() => offlineQueue.count());

  useEffect(() => {
    const refresh = () => setCount(offlineQueue.count());
    window.addEventListener('qra:queue-changed', refresh);
    return () => window.removeEventListener('qra:queue-changed', refresh);
  }, []);

  // Nothing to show when online and queue is empty
  if (isOnline && count === 0) return null;

  if (isOnline && count > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 shadow-lg">
        <RefreshCw size={13} className="animate-spin" />
        Back online — syncing {count} queued order{count > 1 ? 's' : ''}…
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-500 text-white text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff size={13} />
      <span>
        You're offline
        {count > 0 ? ` · ${count} order${count > 1 ? 's' : ''} queued` : ''}
        {' — will sync automatically when connection returns'}
      </span>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ADMIN_PATHS = ['/admin', '/kitchen'];

function isAdminRoute(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode =
  ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
  window.matchMedia('(display-mode: standalone)').matches;

export function InstallPrompt() {
  const { pathname } = useLocation();
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-prompt-dismissed') === '1',
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setAndroidPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', '1');
  }

  async function handleAndroidInstall() {
    if (!androidPrompt) return;
    await androidPrompt.prompt();
    const { outcome } = await androidPrompt.userChoice;
    if (outcome === 'accepted') setAndroidPrompt(null);
  }

  // Don't show if already installed, dismissed, or not on an admin route
  if (isInStandaloneMode || dismissed || !isAdminRoute(pathname)) return null;

  // ── iOS: no beforeinstallprompt — show manual instructions ──────────────
  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl px-4 pt-4 pb-6">
        {/* Arrow pointing to Safari share button */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0">
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
        </div>

        <div className="flex items-start gap-3">
          <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600 shrink-0 mt-0.5">
            <Share size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Install QRA App</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Tap the{' '}
              <span className="inline-flex items-center gap-0.5 font-medium text-gray-700">
                <Share size={12} className="inline" /> Share
              </span>{' '}
              button at the bottom of your browser, then tap{' '}
              <strong className="text-gray-800">"Add to Home Screen"</strong>.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Android / desktop: native install prompt ─────────────────────────────
  if (!androidPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3 max-w-sm mx-auto">
      <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600 shrink-0">
        <Download size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">Install QRA App</p>
        <p className="text-xs text-gray-500 mt-0.5">Add to home screen for quick access</p>
      </div>
      <button
        onClick={handleAndroidInstall}
        className="bg-orange-500 text-white text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-orange-600 transition-colors shrink-0"
      >
        Install
      </button>
      <button onClick={handleDismiss} className="text-gray-300 hover:text-gray-500 shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

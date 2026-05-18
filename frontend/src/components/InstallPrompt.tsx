import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ADMIN_PATHS = ['/admin', '/kitchen'];

function isAdminRoute(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function InstallPrompt() {
  const { pathname } = useLocation();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-prompt-dismissed') === '1',
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed || !isAdminRoute(pathname)) return null;

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', '1');
  }

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
        onClick={handleInstall}
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

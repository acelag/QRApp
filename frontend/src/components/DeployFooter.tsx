import { Box, Clock } from 'lucide-react';

// ── Deploy info ──────────────────────────────────────────────────────────────
// Values are injected at build time (see vite.config.ts `define`). On the host,
// __BUILD_TIME__ is effectively the last-deployed timestamp.
const isProd = import.meta.env.PROD;

function formatBuildTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Tiny footer showing environment, version and last-deploy time. */
export function DeployFooter({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400 ${className}`}>
      <span className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-green-400' : 'bg-amber-400'}`} />
        {isProd ? 'Production' : 'Development'}
      </span>
      <span className="flex items-center gap-1"><Box size={11} /> v{__APP_VERSION__}</span>
      <span className="flex items-center gap-1" title={__BUILD_TIME__}>
        <Clock size={11} /> Deployed {relativeTime(__BUILD_TIME__)} · {formatBuildTime(__BUILD_TIME__)}
      </span>
    </div>
  );
}

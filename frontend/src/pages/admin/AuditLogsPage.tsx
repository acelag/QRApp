import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ScrollText, ArrowLeft, Search, Loader2, RefreshCw,
  LogIn, ShieldAlert, UserCog, UtensilsCrossed, Receipt, XCircle, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auditService, type AuditLog } from '../../services/auditService';

const PAGE_SIZE = 100;

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: '',       label: 'All activity' },
  { key: 'auth',   label: 'Logins' },
  { key: 'user',   label: 'Users' },
  { key: 'menu',   label: 'Menu' },
  { key: 'order',  label: 'Orders' },
  { key: 'refund', label: 'Refunds' },
];

// Visual treatment per action
function actionMeta(action: string): { label: string; Icon: React.ElementType; cls: string } {
  switch (action) {
    case 'auth.login':         return { label: 'Login',          Icon: LogIn,          cls: 'bg-green-100 text-green-700' };
    case 'auth.login_failed':  return { label: 'Login failed',   Icon: ShieldAlert,    cls: 'bg-red-100 text-red-600' };
    case 'user.create':        return { label: 'User created',   Icon: UserCog,        cls: 'bg-blue-100 text-blue-700' };
    case 'user.update':        return { label: 'User updated',   Icon: UserCog,        cls: 'bg-blue-100 text-blue-700' };
    case 'user.delete':        return { label: 'User deleted',   Icon: UserCog,        cls: 'bg-red-100 text-red-600' };
    case 'menu.create':        return { label: 'Menu created',   Icon: UtensilsCrossed,cls: 'bg-amber-100 text-amber-700' };
    case 'menu.update':        return { label: 'Menu updated',   Icon: UtensilsCrossed,cls: 'bg-amber-100 text-amber-700' };
    case 'menu.delete':        return { label: 'Menu deleted',   Icon: UtensilsCrossed,cls: 'bg-red-100 text-red-600' };
    case 'order.cancel':       return { label: 'Order cancelled',Icon: XCircle,        cls: 'bg-red-100 text-red-600' };
    case 'refund.create':      return { label: 'Refund',         Icon: Receipt,        cls: 'bg-purple-100 text-purple-700' };
    default:                   return { label: action,           Icon: Activity,       cls: 'bg-gray-100 text-gray-600' };
  }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AuditLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [restaurantId, setRestaurantId] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const buildFilter = useCallback((offset: number) => ({
    restaurantId: restaurantId || undefined,
    action:       action || undefined,
    q:            q.trim() || undefined,
    from:         from ? `${from}T00:00:00.000Z` : undefined,
    to:           to ? `${to}T23:59:59.999Z` : undefined,
    limit:        PAGE_SIZE,
    offset,
  }), [restaurantId, action, q, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditService.list(buildFilter(0));
      setLogs(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [buildFilter]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await auditService.list(buildFilter(logs.length));
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      toast.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  // Restaurants for the filter dropdown
  useEffect(() => {
    axios.get<{ id: string; name: string }[]>(`${import.meta.env.VITE_API_URL ?? ''}/api/restaurants`)
      .then((r) => setRestaurants(r.data.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
  }, []);

  // Reload whenever filters change
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/restaurants')} className="text-gray-400 hover:text-gray-700 transition-colors p-1.5" title="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <ScrollText size={16} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Activity Log</h1>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setAction(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  action === f.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search summary or user…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white text-gray-600"
            >
              <option value="">All restaurants</option>
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 text-gray-600" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 text-gray-600" />
          </div>
        </div>

        {/* Log list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ScrollText size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No activity matches these filters.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {logs.map((log) => {
                const m = actionMeta(log.action);
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${m.cls}`}>
                      <m.Icon size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
                        <span className="text-sm font-medium text-gray-800">{log.userName || '—'}</span>
                        {log.userRole && <span className="text-xs text-gray-400 capitalize">{log.userRole.replace('_', ' ')}</span>}
                      </div>
                      {log.summary && <p className="text-sm text-gray-600 mt-0.5 break-words">{log.summary}</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                        {log.restaurantName && <span>{log.restaurantName}</span>}
                        {log.restaurantName && <span className="text-gray-300">·</span>}
                        <span>{fmtWhen(log.createdAt)}</span>
                        {log.ip && <><span className="text-gray-300">·</span><span className="font-mono">{log.ip}</span></>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

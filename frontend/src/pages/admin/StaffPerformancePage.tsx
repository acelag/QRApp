import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trophy, TrendingUp, ShoppingBag, UserCheck, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { AdminSidebar } from '../../components/AdminSidebar';

interface WaiterStat {
  waiterId: string | null;
  waiterName: string;
  orderCount: number;
  servedCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgServeMins: number;  // 0 = no served orders yet
}

function fmtMins(m: number): string {
  if (m <= 0) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

interface StaffData {
  waiters: WaiterStat[];
}

type Range = 'today' | 'week' | 'month' | 'custom';

function toLocalYMD(d: Date) {
  return d.toLocaleDateString('en-CA');
}

function rangeToFromTo(range: Range, customFrom: string, customTo: string): [string, string] {
  const today = new Date();
  if (range === 'today')  return [toLocalYMD(today), toLocalYMD(today)];
  if (range === 'week') {
    const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    return [toLocalYMD(mon), toLocalYMD(today)];
  }
  if (range === 'month') {
    return [`${toLocalYMD(today).slice(0, 7)}-01`, toLocalYMD(today)];
  }
  return [customFrom, customTo];
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function StaffPerformancePage() {
  const { fmt } = useCurrency();
  const [range, setRange]         = useState<Range>('today');
  const [customFrom, setFrom]     = useState(() => toLocalYMD(new Date()));
  const [customTo, setTo]         = useState(() => toLocalYMD(new Date()));
  const [data, setData]           = useState<StaffData | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    const [from, to] = rangeToFromTo(range, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await axios.get<StaffData>(
        `${import.meta.env.VITE_API_URL ?? ''}/api/reports/staff?from=${from}&to=${to}`,
      );
      setData(res.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, customFrom, customTo]);

  const assigned   = data?.waiters.filter((w) => w.waiterId !== null) ?? [];
  const unassigned = data?.waiters.find((w) => w.waiterId === null);
  const maxRevenue = assigned.reduce((m, w) => Math.max(m, w.totalRevenue), 1);
  const totalOrders   = assigned.reduce((s, w) => s + w.orderCount, 0);
  const totalRevenue  = assigned.reduce((s, w) => s + w.totalRevenue, 0);
  const topWaiter     = assigned[0] ?? null;

  const RANGE_TABS: { label: string; value: Range }[] = [
    { label: 'Today',   value: 'today' },
    { label: 'Week',    value: 'week' },
    { label: 'Month',   value: 'month' },
    { label: 'Custom',  value: 'custom' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
          <Link to="/admin" className="text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Staff Performance</h1>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1.5">
            <RefreshCw size={17} />
          </button>
        </div>

        {/* Range tabs */}
        <div className="px-3 sm:px-4 lg:px-6 pb-3 flex gap-2 overflow-x-auto">
          {RANGE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setRange(t.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                range === t.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="px-3 sm:px-4 lg:px-6 pb-3 flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-orange-300 text-gray-700" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={customTo} onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-orange-300 text-gray-700" />
          </div>
        )}
      </header>

      <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<ShoppingBag size={16} />} label="Assigned Orders" value={String(totalOrders)} />
              <StatCard icon={<TrendingUp size={16} />} label="Waiter Revenue" value={fmt(totalRevenue)} />
              <StatCard icon={<Trophy size={16} />} label="Top Performer" value={topWaiter?.waiterName ?? '—'} small />
            </div>

            {/* Unassigned callout */}
            {unassigned && unassigned.orderCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <UserCheck size={18} className="text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">{unassigned.orderCount} orders</span> have no waiter assigned
                  {' '}({fmt(unassigned.totalRevenue)})
                </p>
              </div>
            )}

            {/* Leaderboard */}
            {assigned.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <UserCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-gray-600">No waiter data yet</p>
                <p className="text-sm mt-1">Assign waiters to orders to see performance</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700">Waiter Leaderboard</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {assigned.map((w, i) => {
                    const barPct = maxRevenue > 0 ? Math.round((w.totalRevenue / maxRevenue) * 100) : 0;
                    return (
                      <div key={w.waiterId ?? w.waiterName} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg w-6 text-center shrink-0">
                            {i < 3 ? MEDAL[i] : <span className="text-xs font-bold text-gray-400">#{i + 1}</span>}
                          </span>
                          <p className="font-semibold text-gray-900 flex-1 text-sm">{w.waiterName}</p>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-gray-900 text-sm">{fmt(w.totalRevenue)}</p>
                            <p className="text-xs text-gray-400">{w.orderCount} orders · {w.servedCount} served</p>
                          </div>
                        </div>
                        {/* Revenue bar */}
                        <div className="ml-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="ml-9 mt-1 flex items-center gap-3">
                          <p className="text-xs text-gray-400">Avg {fmt(w.avgOrderValue)}/order</p>
                          {w.orderCount > 0 && (
                            <p className="text-xs text-gray-400">
                              {Math.round((w.servedCount / w.orderCount) * 100)}% completion
                            </p>
                          )}
                          {w.avgServeMins > 0 && (
                            <p className="text-xs text-gray-400">avg serve {fmtMins(w.avgServeMins)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
      <div className="inline-flex p-2 rounded-xl mb-2 bg-orange-50 text-orange-600">{icon}</div>
      <p className={`font-bold text-gray-900 truncate ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

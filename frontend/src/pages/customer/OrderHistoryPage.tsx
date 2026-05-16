import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClipboardList, UtensilsCrossed, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Session } from '../../services/sessionService';
import { sessionService } from '../../services/sessionService';
import { StatusBadge } from '../../components/StatusBadge';
import type { OrderStatus } from '../../types';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function OrderHistoryPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const sessionId = tableId ? localStorage.getItem(`qra_session_${tableId}`) : null;

  useEffect(() => {
    if (!sessionId) { setLoading(false); setNotFound(true); return; }

    let active = true;
    const fetch = () =>
      sessionService.getSession(sessionId)
        .then((s) => { if (active) setSession(s); })
        .catch(() => { if (active) setNotFound(true); })
        .finally(() => { if (active) setLoading(false); });

    fetch();
    const interval = setInterval(fetch, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [sessionId]);

  const orders = session?.orders ?? [];
  const tableNumber = session?.tableNumber ?? '—';

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link to={`/menu/${tableId}`} className="text-gray-500 hover:text-gray-800 transition-colors">
            <UtensilsCrossed size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
            <p className="text-xs text-gray-400">Table {tableNumber}</p>
          </div>
          {session?.status === 'open' && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
              Live
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : notFound || orders.length === 0 ? (
          /* Empty / no session */
          <div className="flex flex-col items-center justify-center pt-24 gap-4">
            <div className="bg-orange-50 p-5 rounded-full">
              <ClipboardList size={36} className="text-orange-400" />
            </div>
            <p className="text-gray-500 font-medium">No orders yet</p>
            <Link
              to={`/menu/${tableId}`}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Session status banner */}
            {session?.status === 'paid' ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 text-sm">Bill Paid — Session Closed</p>
                  <p className="text-xs text-green-600">
                    {session.closedAt ? `Paid at ${new Date(session.closedAt).toLocaleTimeString()}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-right">
                Auto-refreshes every 5s
              </p>
            )}

            {/* Order cards */}
            {[...orders].reverse().map((order, idx) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">Order #{orders.length - idx}</span>
                    <StatusBadge status={order.status as OrderStatus} />
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(order.createdAt)}</span>
                </div>
                <ul className="px-4 py-3 space-y-2">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        <span className="font-medium">{item.quantity}×</span> {item.name}
                        {item.notes && (
                          <span className="text-gray-400 italic ml-1 text-xs">({item.notes})</span>
                        )}
                      </span>
                      <span className="text-gray-600 tabular-nums shrink-0 ml-2">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Subtotal</span>
                  <span className="font-semibold text-gray-800 text-sm">${order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ))}

            {/* Session total */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4 flex justify-between items-center">
              <span className="font-semibold text-orange-800">Session Total</span>
              <span className="text-xl font-bold text-orange-600">${(session?.totalAmount ?? 0).toFixed(2)}</span>
            </div>
          </>
        )}
      </main>

      {/* Order More CTA */}
      {orders.length > 0 && session?.status === 'open' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <Link
              to={`/menu/${tableId}`}
              className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl font-semibold transition-colors"
            >
              + Order More
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

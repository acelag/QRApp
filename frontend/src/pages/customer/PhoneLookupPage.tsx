import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Search, ArrowLeft, ShoppingBag, BedDouble, MapPin, ChevronRight, Clock } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { StatusBadge } from '../../components/StatusBadge';
import { useCurrency } from '../../context/CurrencyContext';
import type { Order } from '../../types';

export function PhoneLookupPage() {
  const navigate = useNavigate();
  const { fmt } = useCurrency();
  const [phone, setPhone]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders]     = useState<Order[]>([]);
  const [error, setError]       = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setOrders([]);
    try {
      const result = await orderService.getOrdersByPhone(trimmed);
      setOrders(result);
      setSearched(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
            <p className="text-sm text-gray-400">Look up your recent orders</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 pb-16 space-y-5">
        {/* Search card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
              <Phone size={18} className="text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Enter your phone number</p>
              <p className="text-xs text-gray-400">We'll find orders from the last 30 days</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSearched(false); setOrders([]); setError(''); }}
              placeholder="e.g. 0771234567"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search size={16} />
              )}
              Find
            </button>
          </form>

          {error && (
            <p className="mt-3 text-sm text-red-500 flex items-center gap-1.5">
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        {searched && !loading && (
          <>
            {orders.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-gray-400 text-base font-medium">No orders found</p>
                <p className="text-gray-300 text-sm">
                  Make sure the number matches what you entered when ordering
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                  {orders.length} order{orders.length !== 1 ? 's' : ''} found
                </p>
                {orders.map((order) => {
                  const itemSummary = order.items.slice(0, 3).map((i) =>
                    i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name,
                  ).join(', ') + (order.items.length > 3 ? ` +${order.items.length - 3} more` : '');

                  const d = new Date(order.createdAt);
                  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <Link
                      key={order.id}
                      to={`/order-success/${order.id}`}
                      className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-orange-200 transition-colors active:scale-[0.99]"
                    >
                      {/* Order type strip */}
                      <div className={`px-4 py-2.5 flex items-center justify-between ${
                        order.orderType === 'takeaway'     ? 'bg-purple-50'
                        : order.orderType === 'room-service' ? 'bg-blue-50'
                        : 'bg-orange-50'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {order.orderType === 'takeaway' ? (
                            <><ShoppingBag size={13} className="text-purple-500" /><span className="text-sm font-bold text-purple-700">Takeaway</span></>
                          ) : order.orderType === 'room-service' ? (
                            <><BedDouble size={13} className="text-blue-500" /><span className="text-sm font-bold text-blue-700">Room {order.roomNumber}</span></>
                          ) : (
                            <><MapPin size={13} className="text-orange-500" /><span className="text-sm font-bold text-orange-700">Table {order.tableNumber}</span></>
                          )}
                          {order.orderNumber && (
                            <span className="text-xs text-gray-400 font-medium">#{order.orderNumber}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>

                      {/* Body */}
                      <div className="px-4 py-3">
                        <p className="text-sm text-gray-700 leading-snug mb-2">{itemSummary}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} />
                            <span>{dateStr} · {timeStr}</span>
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{fmt(order.totalAmount)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

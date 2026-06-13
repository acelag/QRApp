import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';

export function ReadyDisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flash, setFlash] = useState(false);
  const prevCountRef = { current: 0 };

  useEffect(() => {
    const load = () =>
      orderService.getOrders().then((data) => {
        const ready = data.filter((o) => o.status === 'ready')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Flash if new ready orders appeared
        if (ready.length > prevCountRef.current) {
          setFlash(true);
          setTimeout(() => setFlash(false), 800);
        }
        prevCountRef.current = ready.length;
        setOrders(ready);
      }).catch(() => {});

    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const takeaway = orders.filter((o) => o.orderType === 'takeaway');
  const dineIn   = orders.filter((o) => o.orderType === 'dine-in');

  return (
    <div className={`min-h-screen bg-gray-900 text-white flex flex-col transition-colors duration-300 ${flash ? 'bg-green-900' : 'bg-gray-900'}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <Bell size={20} className={orders.length > 0 ? 'text-green-400 animate-pulse' : 'text-gray-500'} />
          <h1 className="text-xl font-bold tracking-wide">ORDER READY</h1>
        </div>
        <div className="text-sm text-gray-400 tabular-nums">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-8 py-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pt-24 text-gray-600 select-none">
            <div className="text-8xl mb-6">🍽️</div>
            <p className="text-2xl font-semibold tracking-wide">No orders ready yet</p>
            <p className="text-gray-500 mt-2 text-sm">This screen updates automatically</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* â”€â”€ Takeaway ready â”€â”€ */}
            {takeaway.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Takeaway</span>
                  <div className="flex-1 h-px bg-purple-900" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {takeaway.map((order) => (
                    <div
                      key={order.id}
                      className="bg-purple-600 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 shadow-lg animate-pulse-once"
                    >
                      <span className="text-3xl font-black tracking-tight leading-none">
                        {order.orderNumber ?? order.id.slice(0, 6).toUpperCase()}
                      </span>
                      {order.customerName && (
                        <span className="text-sm text-purple-200 font-medium truncate w-full">{order.customerName}</span>
                      )}
                      <span className="text-xs text-purple-300 mt-1">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* â”€â”€ Dine-in ready â”€â”€ */}
            {dineIn.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Dine-in</span>
                  <div className="flex-1 h-px bg-orange-900" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {dineIn.map((order) => (
                    <div
                      key={order.id}
                      className="bg-orange-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 shadow-lg"
                    >
                      <span className="text-xs text-orange-200 font-semibold uppercase tracking-wide">Table</span>
                      <span className="text-5xl font-black leading-none">{order.tableNumber}</span>
                      {order.orderNumber && (
                        <span className="text-xs text-orange-200 mt-1 font-medium">{order.orderNumber}</span>
                      )}
                      <span className="text-xs text-orange-300 mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Footer bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex items-center justify-between text-xs text-gray-500">
        <span>Auto-refreshes every 4 seconds</span>
        <span>{orders.length} order{orders.length !== 1 ? 's' : ''} ready</span>
      </footer>
    </div>
  );
}

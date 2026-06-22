import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, ChefHat, Bell, Loader2, Receipt, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { restaurantService, type RestaurantInfo } from '../../services/restaurantService';
import { useCurrency } from '../../context/CurrencyContext';

const POLL_MS = 10000;

function Divider({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className={`border-t my-3 ${dashed ? 'border-dashed border-gray-300' : 'border-gray-200'}`} />
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  if (status === 'pending') return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
      <Clock size={16} className="text-amber-500 shrink-0" />
      <span className="font-semibold text-sm text-amber-700">Order received — being processed</span>
    </div>
  );
  if (status === 'preparing') return (
    <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
      <ChefHat size={16} className="text-orange-500 shrink-0" />
      <span className="font-semibold text-sm text-orange-700">Kitchen is preparing your order</span>
    </div>
  );
  if (status === 'ready') return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
      <Bell size={16} className="text-blue-500 shrink-0" />
      <span className="font-semibold text-sm text-blue-700">Ready for collection / delivery</span>
    </div>
  );
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
      <XCircle size={16} className="text-red-400 shrink-0" />
      <span className="font-semibold text-sm text-red-600">Order cancelled</span>
    </div>
  );
  return null;
}

export function OrderBillPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { fmt, loadCurrency } = useCurrency();

  const [order, setOrder]   = useState<Order | null>(null);
  const [info, setInfo]     = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  const load = useCallback(async (id: string) => {
    try {
      const o = await orderService.getOrder(id);
      setOrder(o);
      if (o.restaurantId) {
        loadCurrency(o.restaurantId);
        restaurantService.getRestaurantInfo(o.restaurantId).then(setInfo).catch(() => {});
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadCurrency]);

  useEffect(() => { if (orderId) load(orderId); }, [orderId, load]);

  useEffect(() => {
    if (!orderId || order?.status === 'ready' || order?.status === 'cancelled') return;
    const timer = setInterval(() => load(orderId), POLL_MS);
    return () => clearInterval(timer);
  }, [orderId, order?.status, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <Receipt size={40} className="text-gray-300" />
        <p className="text-gray-600 font-medium">Receipt not found</p>
        <p className="text-sm text-gray-400">This order may have been removed or the link is invalid.</p>
      </div>
    );
  }

  const showOrderNo   = info?.receiptShowOrderNo   !== false;
  const showUnitPrice = info?.receiptShowUnitPrice !== false;
  const footerLine1   = info?.receiptFooterLine1 ?? 'Thank you for your order!';
  const footerLine2   = info?.receiptFooterLine2 ?? 'Please come again 🙏';
  const headerLine1   = info?.receiptHeaderLine1 ?? '';
  const headerLine2   = info?.receiptHeaderLine2 ?? '';

  const isRoom      = order.orderType === 'room-service';
  const isTakeaway  = order.orderType === 'takeaway';
  const typeLabel   = isRoom ? 'Room Service Receipt' : 'Takeaway Receipt';

  const itemsSubtotal = order.totalAmount
    - (order.taxAmount ?? 0)
    - (order.serviceChargeAmount ?? 0)
    + (order.discountAmount ?? 0);

  const hasCharges = (order.discountAmount ?? 0) > 0
    || (order.taxAmount ?? 0) > 0
    || (order.serviceChargeAmount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">

      {/* Status banner */}
      <div className="w-full max-w-sm mb-4">
        <StatusBadge status={order.status} />
      </div>

      {/* Receipt card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md overflow-hidden">

        {/* Restaurant header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-dashed border-gray-200">
          {info?.logo && (
            <img src={info.logo} alt={info.name} className="w-14 h-14 object-contain mx-auto mb-3 rounded-xl" />
          )}
          <h1 className="text-lg font-bold text-gray-900">{info?.name ?? 'Restaurant'}</h1>
          {headerLine1 && <p className="text-xs text-gray-500 mt-0.5">{headerLine1}</p>}
          {headerLine2 && <p className="text-xs text-gray-500">{headerLine2}</p>}

          <div className="mt-3">
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase">{typeLabel}</p>
            {isRoom && order.roomNumber && (
              <p className="text-xs text-gray-400 mt-0.5">Room {order.roomNumber}</p>
            )}
            {isTakeaway && order.customerName && (
              <p className="text-xs text-gray-400 mt-0.5">{order.customerName}</p>
            )}
          </div>
        </div>

        {/* Order number */}
        {showOrderNo && order.orderNumber && (
          <div className="px-6 pt-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Order No:</span>
              <span className="font-mono font-semibold text-gray-700">{order.orderNumber}</span>
            </div>
            <Divider dashed />
          </div>
        )}

        {/* Items */}
        <div className="px-6 pb-2">
          <ul className="space-y-3">
            {order.items.map((item, idx) => {
              const toppingsCost = (item.toppings ?? []).reduce((s, tp) => s + tp.price, 0);
              const unitPrice    = item.price + toppingsCost;
              return (
                <li key={idx}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-800 flex-1 pr-2">
                      <span className="font-semibold">{item.quantity}x</span> {item.name}
                      {item.size === 'large' ? ' (L)' : ''}
                      {item.notes && <span className="ml-1 text-xs text-gray-400 italic">({item.notes})</span>}
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                      {fmt((item.price + toppingsCost) * item.quantity)}
                    </span>
                  </div>
                  {(item.toppings ?? []).map((tp, ti) => (
                    <div key={ti} className="flex justify-between text-xs text-gray-400 pl-5 mt-0.5">
                      <span>+ {tp.name}</span>
                      {tp.price > 0 && <span className="tabular-nums">{fmt(tp.price)}</span>}
                    </div>
                  ))}
                  {showUnitPrice && (
                    <p className="text-xs text-gray-400 pl-5 mt-0.5">{fmt(unitPrice)} each</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Totals */}
        <div className="px-6 pb-5">
          <Divider dashed />
          {hasCharges ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmt(itemsSubtotal)}</span>
              </div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                  <span className="tabular-nums">−{fmt(order.discountAmount ?? 0)}</span>
                </div>
              )}
              {(order.serviceChargeAmount ?? 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{info?.serviceChargeName ?? 'Service Charge'}</span>
                  <span className="tabular-nums">{fmt(order.serviceChargeAmount ?? 0)}</span>
                </div>
              )}
              {(order.taxAmount ?? 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{info?.taxName ?? 'Tax'}</span>
                  <span className="tabular-nums">{fmt(order.taxAmount ?? 0)}</span>
                </div>
              )}
              <Divider />
            </div>
          ) : null}
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900 text-base">TOTAL</span>
            <span className="font-bold text-gray-900 text-base tabular-nums">{fmt(order.totalAmount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center border-t border-dashed border-gray-200 pt-4">
          <p className="text-sm text-gray-600 font-medium">{footerLine1}</p>
          {footerLine2 && <p className="text-xs text-gray-400 mt-1">{footerLine2}</p>}
        </div>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-400 mt-4">
        {new Date(order.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}

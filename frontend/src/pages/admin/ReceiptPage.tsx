import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { restaurantService, computeCharges, getCurrencySymbol, type RestaurantSettings } from '../../services/restaurantService';

function Line({ char = '-' }: { char?: string }) {
  return <p style={{ margin: '4px 0' }}>{char.repeat(32)}</p>;
}

export function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    orderService
      .getOrder(orderId)
      .then(async (o) => {
        setOrder(o);
        // Load billing settings for this restaurant
        if (o.restaurantId) {
          restaurantService.getRestaurantById(o.restaurantId).then(setSettings).catch(() => {});
        } else {
          restaurantService.getMyRestaurant().then(setSettings).catch(() => {});
        }
        setTimeout(() => window.print(), 300);
      })
      .catch(() => setError(true));
  }, [orderId]);

  if (error) {
    return <p style={{ fontFamily: 'monospace', padding: 16 }}>Order not found.</p>;
  }

  if (!order) {
    return <p style={{ fontFamily: 'monospace', padding: 16 }}>Loading…</p>;
  }

  const now = new Date(order.createdAt);
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const subtotal = order.totalAmount;
  const sym = getCurrencySymbol(settings?.currency ?? 'USD');
  const fmtAmt = (n: number) => `${sym}${n.toFixed(2)}`;
  // Service charge → dine-in only | Tax → all orders
  const charges = computeCharges(subtotal, {
    serviceChargePct: order.orderType === 'dine-in' ? (settings?.serviceChargePct ?? 0) : 0,
    taxPct:           settings?.taxPct ?? 0,
  });

  return (
    <>
      {/* Thermal print styles — injected inline so they work in the new window */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }

        @page {
          size: 80mm auto;
          margin: 4mm;
        }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }

        .receipt {
          width: 72mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.5;
          color: #000;
          padding: 4px;
        }

        .center  { text-align: center; }
        .right   { text-align: right; }
        .bold    { font-weight: bold; }
        .large   { font-size: 14px; }
        .small   { font-size: 10px; }

        .row {
          display: flex;
          justify-content: space-between;
        }
        .row .name  { flex: 1; padding-right: 4px; word-break: break-word; }
        .row .price { white-space: nowrap; }

        .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 13px;
          margin-top: 2px;
        }

        .print-btn {
          display: block;
          margin: 16px auto;
          padding: 8px 24px;
          font-size: 14px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>

      {/* On-screen print button — hidden when printing */}
      <div className="no-print" style={{ textAlign: 'center', paddingTop: 16 }}>
        <button className="print-btn" onClick={() => window.print()}>
          🖨️ Print Receipt
        </button>
      </div>

      <div className="receipt">
        {/* Header */}
        {settings?.logo && (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <img src={settings.logo} alt="Logo" style={{ maxWidth: 80, maxHeight: 80, objectFit: 'contain', margin: '0 auto' }} />
          </div>
        )}
        <p className="center bold large">{settings?.name ?? 'RESTAURANT'}</p>
        <Line />

        <p className="center bold">RECEIPT</p>
        <Line char=" " />

        <div className="row">
          <span>Date:</span><span>{dateStr}</span>
        </div>
        <div className="row">
          <span>Time:</span><span>{timeStr}</span>
        </div>
        <div className="row">
          <span>Table:</span><span>{order.tableNumber}</span>
        </div>
        <div className="row">
          <span>Order #:</span><span>{order.id.slice(0, 8).toUpperCase()}</span>
        </div>

        <Line />

        {/* Items */}
        {order.items.map((item, idx) => {
          const toppingsTotal = (item.toppings ?? []).reduce((s: number, t: { price: number }) => s + t.price, 0);
          return (
            <div key={idx} style={{ marginBottom: 4 }}>
              <div className="row">
                <span className="name bold">
                  {item.quantity}x {item.name}
                  {item.size ? ` (${item.size === 'large' ? 'Large' : 'Regular'})` : ''}
                </span>
                <span className="price">{fmtAmt((item.price + toppingsTotal) * item.quantity)}</span>
              </div>
              {(item.toppings ?? []).map((t: { name: string; price: number }, ti: number) => (
                <div key={ti} className="row small" style={{ paddingLeft: 12 }}>
                  <span>+ {t.name}</span>
                  {t.price > 0 && <span>+{fmtAmt(t.price)}</span>}
                </div>
              ))}
              {item.notes && (
                <p className="small" style={{ paddingLeft: 12, color: '#555' }}>
                  * {item.notes}
                </p>
              )}
              <div className="row small" style={{ paddingLeft: 12 }}>
                <span>{fmtAmt(item.price + toppingsTotal)} each</span>
              </div>
            </div>
          );
        })}

        <Line />

        {/* Totals */}
        <div className="row">
          <span>Subtotal</span>
          <span>{fmtAmt(subtotal)}</span>
        </div>
        {charges.serviceCharge > 0 && (
          <div className="row">
            <span>Service Charge ({settings?.serviceChargePct}%)</span>
            <span>{fmtAmt(charges.serviceCharge)}</span>
          </div>
        )}
        {charges.tax > 0 && (
          <div className="row">
            <span>Tax ({settings?.taxPct}%)</span>
            <span>{fmtAmt(charges.tax)}</span>
          </div>
        )}
        <Line />
        <div className="total-row">
          <span>TOTAL</span>
          <span>{fmtAmt(charges.grandTotal)}</span>
        </div>

        <Line />

        {/* Footer */}
        <p className="center" style={{ marginTop: 8 }}>Thank you for dining with us!</p>
        <p className="center small" style={{ marginTop: 4 }}>Please come again 🙏</p>
        <Line char=" " />
        <Line char=" " />
      </div>
    </>
  );
}

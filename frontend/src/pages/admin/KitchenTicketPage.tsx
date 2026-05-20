import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Order } from '../../types';
import { orderService } from '../../services/orderService';

function Dash({ char = '-' }: { char?: string }) {
  return <p style={{ margin: '4px 0', letterSpacing: 1 }}>{char.repeat(32)}</p>;
}

export function KitchenTicketPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    orderService
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        setTimeout(() => window.print(), 300);
      })
      .catch(() => setError(true));
  }, [orderId]);

  if (error) return <p style={{ fontFamily: 'monospace', padding: 16 }}>Order not found.</p>;
  if (!order) return <p style={{ fontFamily: 'monospace', padding: 16 }}>Loading…</p>;

  const now     = new Date(order.createdAt);
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  function locationLine(): string {
    if (order!.orderType === 'room-service') return `ROOM  ${order!.roomNumber ?? '—'}`;
    if (order!.orderType === 'takeaway')     return `TAKEAWAY${order!.customerName ? `  ·  ${order!.customerName.toUpperCase()}` : ''}`;
    return `TABLE  ${order!.tableNumber ?? '—'}`;
  }

  return (
    <>
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

        .ticket {
          width: 72mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.55;
          color: #000;
          padding: 4px;
        }

        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .right  { text-align: right; }

        .headline {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          letter-spacing: 2px;
        }

        .order-ref {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
        }

        .location {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          letter-spacing: 1px;
        }

        .item-name {
          font-size: 15px;
          font-weight: bold;
        }

        .item-qty {
          font-size: 17px;
          font-weight: bold;
        }

        .topping {
          font-size: 12px;
          padding-left: 20px;
        }

        .note {
          font-size: 12px;
          font-weight: bold;
          padding-left: 20px;
        }

        .footer-total {
          font-size: 13px;
          font-weight: bold;
          text-align: center;
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

      {/* On-screen button — hidden when printing */}
      <div className="no-print" style={{ textAlign: 'center', paddingTop: 16 }}>
        <button className="print-btn" onClick={() => window.print()}>
          🖨️ Print Kitchen Ticket
        </button>
      </div>

      <div className="ticket">

        {/* Header */}
        <p className="headline">KITCHEN</p>
        <Dash char="=" />

        {/* Order ref + time */}
        <p className="order-ref">
          {order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(0, 6).toUpperCase()}`}
        </p>
        <p className="center" style={{ fontSize: 11, marginTop: 2 }}>
          {dateStr}  ·  {timeStr}
        </p>

        <Dash />

        {/* Location banner */}
        <p className="location">{locationLine()}</p>

        <Dash char="=" />

        {/* Items — no prices, large and clear */}
        {order.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="item-qty">{item.quantity}×</span>
              <span className="item-name">
                {item.name}
                {item.size && (
                  <span style={{ fontSize: 12, fontWeight: 'normal' }}>
                    {' '}({item.size === 'large' ? 'L' : 'R'})
                  </span>
                )}
              </span>
            </div>
            {(item.toppings ?? []).map((t, ti) => (
              <p key={ti} className="topping">+ {t.name}</p>
            ))}
            {item.notes && (
              <p className="note">★ {item.notes}</p>
            )}
          </div>
        ))}

        <Dash char="=" />

        {/* Footer */}
        <p className="footer-total">{totalQty} item{totalQty !== 1 ? 's' : ''} total</p>
        <Dash char=" " />
        <Dash char=" " />
      </div>
    </>
  );
}

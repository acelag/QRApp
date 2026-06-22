import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChefHat, Bell, X, ChevronRight } from 'lucide-react';
import { orderService } from '../services/orderService';
import type { Order } from '../types';

// ── Persistence helpers ──────────────────────────────────────────────────────

export interface StoredActiveOrder {
  orderId: string;
  orderNumber: string | null;
  restaurantId: string;
  orderType: string;
  placedAt: string;
}

const STORAGE_KEY = 'qra-active-order';
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // auto-expire after 4 h

export function saveActiveOrder(
  orderId: string,
  orderNumber: string | null | undefined,
  restaurantId: string,
  orderType: string,
) {
  const entry: StoredActiveOrder = {
    orderId,
    orderNumber: orderNumber ?? null,
    restaurantId,
    orderType,
    placedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function clearActiveOrder() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadStoredOrder(restaurantId: string, orderType: string): StoredActiveOrder | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry: StoredActiveOrder = JSON.parse(raw);
    if (entry.restaurantId !== restaurantId) return null;
    if (entry.orderType && entry.orderType !== orderType) return null;
    if (Date.now() - new Date(entry.placedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending: {
    label: 'Order Received',
    Icon: Clock,
    dot:  'bg-amber-400',
    strip:'bg-amber-400',
    card: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    sub:  'text-amber-600',
    pulse: true,
  },
  preparing: {
    label: 'Being Prepared',
    Icon: ChefHat,
    dot:  'bg-orange-500',
    strip:'bg-orange-500',
    card: 'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    sub:  'text-orange-600',
    pulse: true,
  },
  ready: {
    label: 'Ready — come collect!',
    Icon: Bell,
    dot:  'bg-green-500',
    strip:'bg-green-500',
    card: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    sub:  'text-green-600',
    pulse: false,
  },
} as const;

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  restaurantId: string;
  orderType: string;
  /** Pass true when a bottom sheet / cart panel is open to avoid overlap */
  hidden?: boolean;
}

export function ActiveOrderBanner({ restaurantId, orderType, hidden }: Props) {
  const [stored, setStored]       = useState<StoredActiveOrder | null>(null);
  const [order, setOrder]         = useState<Order | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible]     = useState(false); // for slide-up animation
  const [bump, setBump]           = useState(false);
  const prevStatus                = useRef<string | null>(null);
  const readyTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage whenever restaurantId resolves
  useEffect(() => {
    if (!restaurantId) return;
    const entry = loadStoredOrder(restaurantId, orderType);
    setStored(entry);
    setDismissed(false);
    if (entry) setTimeout(() => setVisible(true), 50); // let DOM mount first
  }, [restaurantId]);

  // Poll order every 8 s
  useEffect(() => {
    if (!stored) return;
    let cancelled = false;

    const poll = () => {
      orderService.getOrder(stored.orderId)
        .then((o) => {
          if (cancelled) return;
          setOrder((prev) => {
            if (prev && prev.status !== o.status) {
              setBump(true);
              setTimeout(() => setBump(false), 600);
            }
            return o;
          });

          if (o.status === 'cancelled') {
            clearActiveOrder();
            setStored(null);
            return;
          }

          // Auto-clear localStorage 3 min after "ready" so it doesn't re-show on next visit
          if (o.status === 'ready' && prevStatus.current !== 'ready') {
            readyTimer.current = setTimeout(() => {
              clearActiveOrder();
            }, 3 * 60 * 1000);
          }
          prevStatus.current = o.status;
        })
        .catch(() => {});
    };

    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (readyTimer.current) clearTimeout(readyTimer.current);
    };
  }, [stored]);

  const show = stored && order && !dismissed && !hidden && order.status !== 'cancelled';
  if (!show) return null;

  const cfg = STATUS_CFG[order.status as keyof typeof STATUS_CFG];
  if (!cfg) return null;

  const { Icon } = cfg;
  const num = order.orderNumber ?? stored.orderNumber;

  return (
    <div
      className={`fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm
        transition-all duration-300 ease-out
        ${visible ? '-translate-x-1/2 translate-y-0 opacity-100' : '-translate-x-1/2 translate-y-4 opacity-0'}
        ${bump ? 'scale-[1.03]' : 'scale-100'}`}
    >
      <div className={`${cfg.card} border rounded-2xl shadow-lg overflow-hidden`}>
        {/* Colour accent strip */}
        <div className={`h-1 w-full ${cfg.strip}`} />

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Pulsing status dot */}
          <div className="relative flex-none w-8 h-8">
            <div className={`w-8 h-8 rounded-full ${cfg.dot} flex items-center justify-center text-white`}>
              <Icon size={14} />
            </div>
            {cfg.pulse && (
              <div className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-30`} />
            )}
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${cfg.text}`}>{cfg.label}</p>
            {num && <p className={`text-xs ${cfg.sub}`}>Order #{num}</p>}
          </div>

          {/* View link */}
          <Link
            to={`/order-success/${stored.orderId}`}
            className={`flex items-center gap-0.5 text-xs font-semibold shrink-0 ${cfg.text}`}
          >
            View <ChevronRight size={12} />
          </Link>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className={`${cfg.sub} ml-0.5 shrink-0`}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

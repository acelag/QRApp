import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, RotateCcw, Clock, ChefHat, Bell, PlusCircle } from 'lucide-react';
import type { Order } from '../../types';
import type { CartItem } from '../../types/Order';
import { orderService } from '../../services/orderService';
import { restaurantService } from '../../services/restaurantService';
import { CustomerNotifyButton } from '../../components/CustomerNotifyButton';
import { useCurrency } from '../../context/CurrencyContext';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

const STATUS_STEPS = ['pending', 'preparing', 'ready'] as const;
type StatusStep = (typeof STATUS_STEPS)[number];

type TFunction = (key: string) => string;

function getStepMeta(t: TFunction): Record<StatusStep, { label: string; sublabel: string; icon: React.ReactNode; color: string; bg: string; ring: string }> {
  return {
    pending: {
      label: t('orderSuccess.received'),
      sublabel: t('orderSuccess.orderConfirmed'),
      icon: <Clock size={15} />,
      color: 'text-amber-600',
      bg: 'bg-amber-500',
      ring: 'ring-amber-300',
    },
    preparing: {
      label: t('orderSuccess.preparing'),
      sublabel: t('orderSuccess.kitchenOnIt'),
      icon: <ChefHat size={15} />,
      color: 'text-orange-600',
      bg: 'bg-orange-500',
      ring: 'ring-orange-300',
    },
    ready: {
      label: t('orderSuccess.ready'),
      sublabel: t('orderSuccess.comeCollect'),
      icon: <Bell size={15} />,
      color: 'text-blue-600',
      bg: 'bg-blue-500',
      ring: 'ring-blue-300',
    },
  };
}

function getStatusHeadline(t: TFunction): Record<StatusStep, string> {
  return {
    pending: t('orderSuccess.orderPlaced'),
    preparing: t('orderSuccess.beingPrepared'),
    ready: t('orderSuccess.readyForYou'),
  };
}

export function OrderSuccessPage() {
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const { fmt } = useCurrency();
  const { bulkAdd } = useCart();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!orderId) return;
    const poll = () => {
      orderService.getOrder(orderId).then((o) => {
        setOrder((prev) => {
          if (prev && prev.status !== o.status) {
            setBump(true);
            setTimeout(() => setBump(false), 700);
          }
          return o;
        });
        if (firstLoad.current && o.restaurantId) {
          firstLoad.current = false;
          restaurantService.getRestaurantInfo(o.restaurantId)
            .then((info) => setWaitTimeMin(info.waitTimeMin))
            .catch(() => {});
        }
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [orderId]);

  function handleReorder() {
    if (!order) return;
    const items: CartItem[] = order.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      notes: i.notes,
      size: i.size,
      toppings: i.toppings,
    }));
    if (order.orderType === 'dine-in' && order.tableId) {
      bulkAdd(items);
      toast.success(t('orderSuccess.itemsAddedToCart'));
      navigate(`/menu/${order.tableId}`);
    } else if (order.orderType === 'takeaway' && order.restaurantId) {
      navigate(`/takeaway/${order.restaurantId}`, { state: { reorderItems: items } });
    } else if (order.orderType === 'room-service' && order.roomId) {
      navigate(`/room/${order.roomId}`, { state: { reorderItems: items } });
    } else {
      toast.error(t('orderSuccess.cannotReorder'));
    }
  }

  function handleAddItems() {
    if (!order) return;
    const state = { appendToOrderId: order.id, appendToOrderNumber: order.orderNumber };
    if (order.orderType === 'dine-in' && order.tableId) {
      navigate(`/menu/${order.tableId}`, { state });
    } else if (order.orderType === 'takeaway' && order.restaurantId) {
      navigate(`/takeaway/${order.restaurantId}`, { state });
    } else if (order.orderType === 'room-service' && order.roomId) {
      navigate(`/room/${order.roomId}`, { state });
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  const currentStep = order.status as StatusStep;
  const currentIdx = STATUS_STEPS.indexOf(currentStep);
  const STEP_META = getStepMeta(t);
  const STATUS_HEADLINE = getStatusHeadline(t);
  const meta = STEP_META[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-10 pb-16 px-4">
      <div className="w-full max-w-sm space-y-3">

        {/* Hero card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Top accent bar — color matches current status */}
          <div className={`h-1.5 w-full transition-colors duration-700 ${meta.bg}`} />

          <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center">
            {/* Animated checkmark / status icon */}
            <div
              className={`relative flex items-center justify-center w-20 h-20 rounded-full mb-4 transition-all duration-500 ${
                currentStep === 'ready' ? 'bg-green-50' : 'bg-orange-50'
              } ${bump ? 'scale-110' : 'scale-100'}`}
            >
              {currentStep === 'ready' ? (
                <CheckCircle className="text-green-500 animate-[bounce_0.6s_ease-out]" size={48} />
              ) : (
                <>
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${meta.bg}`} />
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${meta.bg} text-white`}>
                    <span className="scale-125">{meta.icon}</span>
                  </div>
                </>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 transition-all duration-500">
              {STATUS_HEADLINE[currentStep]}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {order.orderType === 'room-service'
                ? t('customer.room', { number: order.roomNumber })
                : order.orderType === 'takeaway'
                ? order.customerName ?? t('customer.takeaway')
                : t('customer.tableNumber', { number: order.tableNumber })}
              {order.orderNumber && (
                <span className="ml-2 font-semibold text-orange-500">#{order.orderNumber}</span>
              )}
            </p>
          </div>

          {/* Status stepper */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between relative">
              {/* Connector line behind steps */}
              <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-100 mx-8 z-0" />
              <div
                className={`absolute left-0 top-4 h-0.5 z-0 mx-8 transition-all duration-700 bg-orange-400`}
                style={{ width: `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
              />
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const sm = STEP_META[step];
                return (
                  <div key={step} className="flex flex-col items-center gap-1.5 z-10 w-14">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all duration-500 ${
                        done
                          ? 'bg-orange-400 scale-95'
                          : active
                          ? `${sm.bg} scale-110 ring-4 ${sm.ring}`
                          : 'bg-gray-200 scale-90'
                      }`}
                    >
                      {done ? (
                        <CheckCircle size={14} />
                      ) : (
                        <span className={active ? '' : 'opacity-50'}>{sm.icon}</span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium text-center leading-tight transition-colors duration-300 ${
                        active ? sm.color : done ? 'text-orange-400' : 'text-gray-300'
                      }`}
                    >
                      {sm.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Wait time banner — only when pending */}
        {waitTimeMin && order.status === 'pending' && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <Clock size={18} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">{t('orderSuccess.estWait', { n: waitTimeMin })}</p>
              <p className="text-xs text-amber-500">{t('orderSuccess.startingSoon')}</p>
            </div>
          </div>
        )}

        {/* Notify button */}
        {order.status !== 'ready' && (
          <CustomerNotifyButton orderId={order.id} />
        )}

        {/* Order items */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('orderSuccess.yourOrder')}</h2>
          <ul className="space-y-2">
            {order.items.map((item, idx) => {
              const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
              return (
                <li key={idx} className="text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-gray-700 flex items-center gap-1.5 flex-wrap flex-1">
                      <span className="font-bold text-gray-900">{item.quantity}×</span>
                      <span>{item.name}</span>
                      {item.size && (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          item.size === 'large' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.size === 'large' ? 'L' : 'R'}
                        </span>
                      )}
                      {item.notes && <span className="text-gray-400 italic text-xs">({item.notes})</span>}
                    </span>
                    <span className="text-gray-600 shrink-0 tabular-nums">{fmt((item.price + toppingsTotal) * item.quantity)}</span>
                  </div>
                  {(item.toppings ?? []).length > 0 && (
                    <ul className="ml-6 mt-0.5 space-y-0.5">
                      {item.toppings!.map((t, ti) => (
                        <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            {(order.discountAmount ?? 0) > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{t('common.subtotal')}</span>
                  <span>{fmt(order.totalAmount + (order.discountAmount ?? 0))}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>{order.promoCode ? t('orderSuccess.discount', { code: order.promoCode }) : t('common.discount')}</span>
                  <span>−{fmt(order.discountAmount ?? 0)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-gray-900">
              <span>{t('common.total')}</span>
              <span>{fmt(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {(order.status === 'pending' || order.status === 'preparing') && (
          <button
            onClick={handleAddItems}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.98] transition-all"
          >
            <PlusCircle size={16} /> Add More Items
          </button>
        )}
        <button
          onClick={handleReorder}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-all ${
            order.status === 'ready'
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <RotateCcw size={16} /> {t('orderSuccess.orderAgain')}
        </button>

        <Link
          to="/my-orders"
          className="block text-center text-sm text-orange-500 font-medium hover:underline py-1"
        >
          {t('orderSuccess.viewPastOrders')}
        </Link>

        <p className="text-center text-xs text-gray-300 pb-2">
          {t('orderSuccess.autoUpdates')}
        </p>
      </div>
    </div>
  );
}

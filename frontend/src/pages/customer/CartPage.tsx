import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2, NotebookPen, Star } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { QuantitySelector } from '../../components/QuantitySelector';
import { orderService } from '../../services/orderService';
import { loyaltyService } from '../../services/loyaltyService';
import type { LoyaltyConfig, LoyaltyAccount } from '../../services/loyaltyService';
import { offlineQueue } from '../../services/offlineQueue';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';

const cartKey = (menuItemId: string, size?: 'regular' | 'large', toppingIds?: string[]) =>
  `${menuItemId}|${size ?? 'regular'}|${(toppingIds ?? []).sort().join(',')}`;

export function CartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const appendToOrderId = (location.state as { appendToOrderId?: string; appendToOrderNumber?: string } | null)?.appendToOrderId;
  const appendToOrderNumber = (location.state as { appendToOrderId?: string; appendToOrderNumber?: string } | null)?.appendToOrderNumber;
  const { items, tableId, tableNumber, sessionId, restaurantId, total, updateQty, removeItem, updateNotes, clearCart } = useCart();
  const { fmt } = useCurrency();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');

  // Loyalty
  const [loyaltyConfig,   setLoyaltyConfig]   = useState<LoyaltyConfig | null>(null);
  const [loyaltyAccount,  setLoyaltyAccount]  = useState<LoyaltyAccount | null>(null);
  const [usePoints,       setUsePoints]       = useState(false);
  const [loyaltyLoading,  setLoyaltyLoading]  = useState(false);
  const loyaltyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced loyalty lookup when phone changes
  useEffect(() => {
    if (loyaltyTimer.current) clearTimeout(loyaltyTimer.current);
    const digits = customerPhone.replace(/\D/g, '');
    if (!restaurantId || digits.length < 8 || appendToOrderId) {
      setLoyaltyConfig(null); setLoyaltyAccount(null); setUsePoints(false); return;
    }
    setLoyaltyLoading(true);
    loyaltyTimer.current = setTimeout(async () => {
      try {
        const { config, account } = await loyaltyService.lookup(restaurantId, digits);
        setLoyaltyConfig(config);
        setLoyaltyAccount(account);
        if (!config) setUsePoints(false);
      } catch {
        setLoyaltyConfig(null); setLoyaltyAccount(null);
      } finally {
        setLoyaltyLoading(false);
      }
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone, restaurantId]);

  // Derived: points to redeem and discount value
  const redeemablePoints = loyaltyConfig && loyaltyAccount && usePoints
    ? Math.min(
        loyaltyAccount.pointsBalance,
        Math.floor(total * (loyaltyConfig.maxRedeemPct / 100) * loyaltyConfig.redeemRate),
      )
    : 0;
  const pointsDiscount = loyaltyConfig ? Math.round((redeemablePoints / loyaltyConfig.redeemRate) * 100) / 100 : 0;
  const finalTotal = Math.max(0, total - pointsDiscount);

  function queueOfflineOrder() {
    const base = `${import.meta.env.VITE_API_URL ?? ''}/api`;
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    if (appendToOrderId) {
      offlineQueue.push({
        method: 'PATCH',
        url: `${base}/orders/${appendToOrderId}/items`,
        body: { items },
        label: `Add ${itemCount} item${itemCount !== 1 ? 's' : ''} to #${appendToOrderNumber ?? appendToOrderId.slice(0, 8).toUpperCase()}`,
      });
    } else {
      offlineQueue.push({
        method: 'POST',
        url: `${base}/orders`,
        body: { tableId, tableNumber, items, sessionId: sessionId ?? undefined, restaurantId: restaurantId ?? undefined, orderType: 'dine-in', customerPhone: customerPhone.trim() || undefined },
        label: `Table ${tableNumber} · ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
      });
    }
    clearCart();
    toast.success("You're offline — order saved and will sync automatically.", { duration: 5000 });
    navigate(-1);
  }

  async function handlePlaceOrder() {
    if (items.length === 0) return;

    if (!navigator.onLine) {
      queueOfflineOrder();
      return;
    }

    setPlacing(true);
    try {
      if (appendToOrderId) {
        await orderService.addItems(appendToOrderId, items);
        clearCart();
        navigate(`/order-success/${appendToOrderId}`, { replace: true });
      } else {
        if (!tableId || !tableNumber) return;
        const order = await orderService.placeOrder(tableId, tableNumber, items, sessionId ?? undefined, restaurantId ?? undefined, undefined, customerPhone.trim() || undefined, redeemablePoints > 0 ? redeemablePoints : undefined);
        clearCart();
        navigate(`/order-success/${order.id}`);
      }
    } catch (err) {
      // Also queue on network failure (e.g. WiFi drops between check and call)
      const isNetworkError = err && typeof err === 'object' && !('response' in (err as object));
      if (isNetworkError) {
        queueOfflineOrder();
      } else {
        toast.error(t('customer.failedOrder'));
      }
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-lg">{t('customer.emptyCart')}</p>
        <button onClick={() => navigate(-1)} className="text-orange-500 font-medium flex items-center gap-1">
          <ArrowLeft size={16} /> {t('customer.backToMenu')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {appendToOrderId ? 'Add to Order' : t('customer.yourCart')}
            </h1>
            <p className="text-sm text-gray-500">
              {appendToOrderId
                ? `Adding to #${appendToOrderNumber ?? appendToOrderId.slice(0, 8).toUpperCase()}`
                : t('customer.tableNumber', { number: tableNumber })}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {items.map((item) => {
          const key = cartKey(item.menuItemId, item.size, item.toppings?.map((t) => t.id));
          const toppingsTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
          const lineUnit = item.price + toppingsTotal;
          return (
            <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.comboId && (
                      <span className="text-xs bg-orange-500 text-white font-semibold px-2 py-0.5 rounded-full">
                        {t('customer.bundle')}
                      </span>
                    )}
                    {item.size && (
                      <span className="text-xs bg-orange-100 text-orange-600 font-medium px-2 py-0.5 rounded-full capitalize">
                        {item.size}
                      </span>
                    )}
                  </div>
                  <p className="text-orange-600 font-medium text-sm">{fmt(item.price)}</p>
                  {(item.comboItems ?? []).length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.comboItems!.join(' · ')}</p>
                  )}
                  {(item.toppings ?? []).length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {item.toppings!.map((t, ti) => (
                        <li key={ti} className="text-xs text-gray-400 flex gap-1">
                          <span>+ {t.name}</span>
                          {t.price > 0 && <span className="text-orange-500">+{fmt(t.price)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.menuItemId, item.size, item.toppings)}
                  className="text-red-400 hover:text-red-500 ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <QuantitySelector
                  value={item.quantity}
                  onChange={(q) => updateQty(item.menuItemId, item.size, item.toppings, q)}
                  min={0}
                />
                <span className="font-bold text-gray-800">{fmt(lineUnit * item.quantity)}</span>
              </div>

              {/* Per-item note */}
              <div className="mt-3">
                {editingNotes === key ? (
                  <div className="flex items-center gap-2">
                    <NotebookPen size={13} className="text-orange-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={item.notes ?? ''}
                      onChange={(e) => updateNotes(item.menuItemId, item.size, item.toppings, e.target.value)}
                      onBlur={() => setEditingNotes(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingNotes(null)}
                      placeholder={t('customer.notePlaceholder')}
                      className="flex-1 text-sm border border-orange-200 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingNotes(key)}
                    className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 w-full text-left transition-colors ${
                      item.notes
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-gray-50 text-gray-400 border border-dashed border-gray-200 hover:border-orange-200 hover:text-orange-400'
                    }`}
                  >
                    <NotebookPen size={12} className="shrink-0" />
                    {item.notes ? item.notes : t('customer.noteHint')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-2">
          {!appendToOrderId && (
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t('customer.phonePlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
            />
          )}

          {/* Loyalty widget */}
          {!appendToOrderId && loyaltyLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <div className="w-3 h-3 border border-gray-300 border-t-orange-400 rounded-full animate-spin" />
              Checking points…
            </div>
          )}
          {!appendToOrderId && loyaltyConfig && loyaltyAccount && (
            <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors ${
              usePoints ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <Star size={15} className={usePoints ? 'text-orange-500' : 'text-gray-400'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">
                  {loyaltyAccount.pointsBalance} pts
                  {usePoints && pointsDiscount > 0 && (
                    <span className="ml-1.5 text-green-600">= {fmt(pointsDiscount)} off</span>
                  )}
                </p>
                {!usePoints && loyaltyAccount.pointsBalance >= loyaltyConfig.minRedeemPoints && (
                  <p className="text-[11px] text-gray-400">
                    Redeem for up to {fmt(Math.floor(loyaltyAccount.pointsBalance / loyaltyConfig.redeemRate))} discount
                  </p>
                )}
                {!usePoints && loyaltyAccount.pointsBalance < loyaltyConfig.minRedeemPoints && (
                  <p className="text-[11px] text-gray-400">
                    Need {loyaltyConfig.minRedeemPoints} pts to redeem
                  </p>
                )}
              </div>
              {loyaltyAccount.pointsBalance >= loyaltyConfig.minRedeemPoints && (
                <button
                  onClick={() => setUsePoints(p => !p)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    usePoints
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-white border border-orange-300 text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  {usePoints ? 'Applied ✓' : 'Use pts'}
                </button>
              )}
            </div>
          )}
          {!appendToOrderId && loyaltyConfig && !loyaltyAccount && customerPhone.replace(/\D/g,'').length >= 8 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <Star size={12} className="text-orange-300" />
              You'll earn {Math.floor(total * loyaltyConfig.pointsPerUnit)} pts for this order
            </div>
          )}

          <div className="flex justify-between text-sm text-gray-500">
            <span>{t('customer.subtotal')}</span>
            <span>{fmt(total)}</span>
          </div>
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600 font-medium">
              <span>Points discount</span>
              <span>−{fmt(pointsDiscount)}</span>
            </div>
          )}
          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-semibold text-base hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {placing
              ? (appendToOrderId ? 'Adding items…' : t('customer.placingOrder'))
              : (appendToOrderId
                  ? `Add to Order · ${fmt(total)}`
                  : t('customer.placeOrder', { amount: fmt(finalTotal) }))}
          </button>
        </div>
      </div>
    </div>
  );
}

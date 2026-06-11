import { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Plus, Minus, Trash2, ChevronUp, ChevronDown, UtensilsCrossed, Tag, CheckCircle, X, RefreshCw, Clock, Search, Package } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { SelectedTopping } from '../../types/Order';
import { effectivePrice } from '../../types/MenuItem';
import type { CartItem } from '../../types/Order';
import { menuService } from '../../services/menuService';
import { restaurantService, computeCharges, type RestaurantInfo } from '../../services/restaurantService';
import { orderService } from '../../services/orderService';
import { promoCodeService, type ValidateResult } from '../../services/promoCodeService';
import { comboService, type Combo } from '../../services/comboService';
import { CategoryTabs } from '../../components/CategoryTabs';
import { ToppingSelectionModal } from '../../components/ToppingSelectionModal';
import { WelcomeScreen } from '../../components/WelcomeScreen';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useTags } from '../../context/TagsContext';
import toast from 'react-hot-toast';

type Size = 'regular' | 'large';

const toppingKey = (toppings?: SelectedTopping[]) => (toppings ?? []).map((t) => t.id).sort().join(',');
const cartKey = (menuItemId: string, size?: Size, toppings?: SelectedTopping[]) =>
  `${menuItemId}|${size ?? 'regular'}|${toppingKey(toppings)}`;

type CartAction =
  | { type: 'ADD';       item: MenuItem; size?: Size; toppings?: SelectedTopping[]; notes?: string }
  | { type: 'ADD_COMBO'; comboId: string; name: string; price: number; comboItems: string[] }
  | { type: 'INC';       key: string }
  | { type: 'DEC';       key: string }
  | { type: 'REMOVE';    key: string }
  | { type: 'SET_NOTES'; key: string; notes: string }
  | { type: 'INIT';      items: CartItem[] }
  | { type: 'CLEAR' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const key = cartKey(action.item.id, action.size, action.toppings);
      const price = effectivePrice(action.item, action.size);
      const exists = state.find((c) => cartKey(c.menuItemId, c.size, c.toppings) === key);
      if (exists) return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...state, { menuItemId: action.item.id, name: action.item.name, price, quantity: 1, size: action.size, toppings: action.toppings, notes: action.notes }];
    }
    case 'INC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity + 1 } : c);
    case 'DEC':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, quantity: c.quantity - 1 } : c).filter((c) => c.quantity > 0);
    case 'REMOVE':
      return state.filter((c) => cartKey(c.menuItemId, c.size, c.toppings) !== action.key);
    case 'SET_NOTES':
      return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === action.key ? { ...c, notes: action.notes || undefined } : c);
    case 'ADD_COMBO': {
      const key = cartKey(action.comboId, undefined, undefined);
      const exists = state.find((c) => cartKey(c.menuItemId, c.size, c.toppings) === key);
      if (exists) return state.map((c) => cartKey(c.menuItemId, c.size, c.toppings) === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...state, { menuItemId: action.comboId, name: action.name, price: action.price, quantity: 1, comboId: action.comboId, comboItems: action.comboItems }];
    }
    case 'INIT': return action.items;
    case 'CLEAR': return [];
    default: return state;
  }
}

export function TakeawayMenuPage() {
  const { t } = useTranslation();
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories]   = useState<Category[]>([]);
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem(`welcome-seen-takeaway-${restaurantId}`));

  const [cart, dispatch]              = useReducer(cartReducer, []);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cartOpen, setCartOpen]       = useState(false);
  const [placing, setPlacing]         = useState(false);
  const [toppingModal, setToppingModal] = useState<{ item: MenuItem; size?: Size } | null>(null);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);
  const [promoInput, setPromoInput]   = useState('');
  const [promoResult, setPromoResult] = useState<ValidateResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [combos, setCombos]           = useState<Combo[]>([]);
  const { fmt, loadCurrency } = useCurrency();
  const { loadTheme } = useTheme();
  const { tags: allTags, loadTags } = useTags();

  function loadMenu() {
    if (!restaurantId) return;
    setLoadError(false);
    setLoading(true);
    restaurantService.getRestaurantInfo(restaurantId).then(setRestaurantInfo).catch(() => {});
    comboService.getCombos(restaurantId).then((c) => setCombos(c.filter((x) => x.active))).catch(() => {});
    Promise.all([
      menuService.getCategories(restaurantId),
      menuService.getItems(restaurantId),
    ]).then(([cats, menuItems]) => {
      setCategories(cats);
      setItems(menuItems.filter((i) => i.available));
      if (restaurantId) { loadCurrency(restaurantId); loadTheme(restaurantId); loadTags(restaurantId); }
      const reorderItems = (location.state as { reorderItems?: CartItem[] } | null)?.reorderItems;
      if (reorderItems?.length) {
        dispatch({ type: 'INIT', items: reorderItems });
        setCartOpen(true);
        toast.success(`${reorderItems.reduce((s, i) => s + i.quantity, 0)} item(s) added — ready to reorder!`);
      }
    }).catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMenu(); }, [restaurantId]);

  const q = searchQuery.trim().toLowerCase();
  const catFiltered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const tagFiltered = activeTag ? catFiltered.filter((i) => (i.tags ?? []).includes(activeTag)) : catFiltered;
  const filtered = q
    ? items
        .filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
        .filter((i) => (activeTag ? (i.tags ?? []).includes(activeTag) : true))
    : tagFiltered;
  const presentSlugs = new Set(items.flatMap((i) => i.tags ?? []));
  const visibleTags = allTags.filter((t) => presentSlugs.has(t.slug));

  const itemCount  = cart.reduce((s, c) => s + c.quantity, 0);
  const subtotal   = cart.reduce((s, c) => s + (c.price + (c.toppings ?? []).reduce((t, tp) => t + tp.price, 0)) * c.quantity, 0);
  const discount   = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0;
  const taxBase    = Math.max(0, subtotal - discount);
  // Takeaway: no service charge; tax applies
  const charges    = computeCharges(taxBase, { serviceChargePct: 0, taxPct: restaurantInfo?.taxPct ?? 0 });
  const total      = charges.grandTotal;


  function handleAdd(item: MenuItem) {
    const hasLarge = (item.largePrice ?? 0) > 0;
    const hasToppings = (item.toppings ?? []).some((t) => t.available);
    if (hasLarge || hasToppings) {
      setToppingModal({ item });
    } else {
      dispatch({ type: 'ADD', item });
    }
  }

  async function applyPromo() {
    if (!promoInput.trim() || !restaurantId) return;
    setPromoLoading(true);
    try {
      const result = await promoCodeService.validate(promoInput.trim(), restaurantId, subtotal);
      setPromoResult(result);
      if (result.valid) toast.success(`Code applied! ${fmt(result.discountAmount ?? 0)} off`);
      else toast.error(result.message ?? 'Invalid promo code');
    } catch {
      toast.error('Failed to validate promo code');
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoResult(null);
    setPromoInput('');
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const order = await orderService.placeTakeawayOrder(
        cart, customerName.trim() || undefined, restaurantId,
        promoResult?.valid ? promoResult.code : undefined,
        customerPhone.trim() || undefined,
      );
      dispatch({ type: 'CLEAR' });
      setPromoResult(null);
      setPromoInput('');
      setCartOpen(false);
      navigate(`/order-success/${order.id}`);
    } catch {
      toast.error(t('customer.failedOrder'));
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShoppingBag size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">Could not load the menu</p>
        <p className="text-sm text-gray-400">Check your connection and try again</p>
        <button
          onClick={loadMenu}
          className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <RefreshCw size={15} /> Try Again
        </button>
      </div>
    );
  }

  if (showWelcome && restaurantInfo) {
    return (
      <WelcomeScreen
        restaurantName={restaurantInfo.name}
        logo={restaurantInfo.logo}
        themeColor={restaurantInfo.themeColor ?? '#a855f7'}
        heroUrl={restaurantInfo.welcomeImageUrl}
        heading={restaurantInfo.welcomeHeading}
        tagline={restaurantInfo.welcomeTagline || t('customer.scanEnjoy')}
        subtitle={t('customer.takeaway')}
        waitTimeMin={restaurantInfo.waitTimeMin}
        waitTimeLabel={restaurantInfo.waitTimeMin != null ? t('customer.waitTime', { n: restaurantInfo.waitTimeMin }) : undefined}
        social={restaurantInfo}
        followUsLabel={t('customer.followUs')}
        ctaLabel={t('customer.viewMenu')}
        poweredByLabel={t('customer.poweredBy')}
        onEnter={() => {
          sessionStorage.setItem(`welcome-seen-takeaway-${restaurantId}`, '1');
          setShowWelcome(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            {restaurantInfo?.logo
              ? <img src={restaurantInfo.logo} alt="logo" className="w-8 h-8 object-contain rounded-md" />
              : <ShoppingBag size={20} className="text-purple-500" />}
            <h1 className="text-xl font-bold text-gray-900">{restaurantInfo?.name ?? t('customer.takeaway')}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-sm text-gray-400">{t('customer.searchMenu')}</p>
            {restaurantInfo?.waitTimeMin && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock size={11} /> {t('customer.waitTime', { n: restaurantInfo.waitTimeMin })}
              </span>
            )}
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>
        {visibleTags.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
            {visibleTags.map((tag) => (
              <button
                key={tag.slug}
                onClick={() => setActiveTag(activeTag === tag.slug ? null : tag.slug)}
                className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  activeTag === tag.slug ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag.emoji} {tag.label}
              </button>
            ))}
          </div>
        )}
        {/* Search bar */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full bg-gray-100 rounded-full pl-9 pr-9 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-300 transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Menu grid */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* Combos & Deals strip */}
        {combos.length > 0 && (
          <section className="mb-5">
            <h2 className="text-sm font-bold text-purple-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package size={14} /> {t('customer.combosAndDeals')}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {combos.map((combo) => (
                <div key={combo.id} className="shrink-0 w-52 bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                  {combo.image
                    ? <img src={combo.image} alt={combo.name} className="w-full h-28 object-cover" />
                    : <div className="w-full h-28 bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center"><Package size={32} className="text-purple-300" /></div>}
                  <div className="p-3">
                    <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{combo.name}</p>
                    {combo.description && <p className="text-xs text-gray-400 line-clamp-1 mb-1">{combo.description}</p>}
                    {combo.items.length > 0 && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {combo.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.menuItemName}`).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-purple-600 font-bold text-base">{fmt(combo.price)}</span>
                      <button
                        onClick={() => dispatch({ type: 'ADD_COMBO', comboId: combo.id, name: combo.name, price: combo.price, comboItems: combo.items.map((i) => i.menuItemName) })}
                        className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-purple-700 active:scale-95 transition-all"
                      >
                        {t('customer.addToCart')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">
            {q ? `No items match "${searchQuery}"` : t('customer.allCategories')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((item) => {
              const hasLarge = item.largePrice != null && item.largePrice > 0;
              const hasToppings = (item.toppings ?? []).some((t) => t.available);
              const regPrice   = effectivePrice(item, 'regular');
              const lrgPrice   = hasLarge ? effectivePrice(item, 'large') : 0;
              const regDisc    = item.discountPct > 0;
              const lrgDisc    = (item.largeDiscountPct ?? 0) > 0;
              const totalInCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);

              return (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${totalInCart > 0 ? 'border-purple-200' : 'border-gray-100'}`}>
                  <div className="relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-36 object-cover" />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                        <UtensilsCrossed size={32} className="text-purple-300" />
                      </div>
                    )}
                    {(regDisc || lrgDisc) && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {regDisc ? item.discountPct : item.largeDiscountPct}% OFF
                      </span>
                    )}
                    {(hasToppings || hasLarge) && (
                      <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {hasToppings ? `+ ${t('customer.extras')}` : 'R / L'}
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">{item.description}</p>
                    )}
                    <div className="mt-2">
                      {regDisc
                        ? <div><span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span><span className="ml-1.5 text-green-600 font-bold">{fmt(regPrice)}</span></div>
                        : <span className="text-purple-600 font-bold">{fmt(regPrice)}</span>}
                      {hasLarge && <span className="text-xs text-gray-400 ml-1">/ L {fmt(lrgPrice)}</span>}
                      <div className="mt-2">
                        <button
                          onClick={() => handleAdd(item)}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${totalInCart > 0 ? 'bg-purple-100 text-purple-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                        >
                          <Plus size={14} /> {totalInCart > 0 ? `${t('customer.addToCart')} (${totalInCart})` : t('customer.addToCart')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart panel */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-lg mx-auto px-4 pb-4">
            {/* Expanded cart */}
            {cartOpen && (
              <div className="bg-white rounded-t-3xl shadow-2xl border border-gray-100 mb-0 max-h-[60vh] flex flex-col">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 mb-2">{t('customer.yourCart')}</p>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('customer.notePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-300 mb-1"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('customer.phonePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-300"
                  />
                </div>

                {/* Cart items */}
                <ul className="overflow-y-auto flex-1 divide-y divide-gray-50 px-4">
                  {cart.map((c) => {
                    const key = cartKey(c.menuItemId, c.size, c.toppings);
                    const toppingsTotal = (c.toppings ?? []).reduce((s, t) => s + t.price, 0);
                    return (
                      <li key={key} className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => dispatch({ type: 'DEC', key })} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center font-bold text-gray-900 text-sm">{c.quantity}</span>
                            <button onClick={() => dispatch({ type: 'INC', key })} className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200">
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{c.name}</span>
                            {c.comboId && <span className="text-xs bg-purple-500 text-white font-semibold px-1.5 py-0.5 rounded-full">{t('customer.bundle')}</span>}
                            {c.size && <span className="text-xs text-purple-500 capitalize">{c.size}</span>}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 shrink-0">{fmt((c.price + toppingsTotal) * c.quantity)}</span>
                          <button onClick={() => dispatch({ type: 'REMOVE', key })} className="text-gray-300 hover:text-red-400 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {(c.toppings ?? []).length > 0 && (
                          <ul className="ml-16 mt-0.5 space-y-0.5">
                            {c.toppings!.map((t, ti) => (
                              <li key={ti} className="text-xs text-gray-400">+ {t.name}{t.price > 0 ? ` (+${fmt(t.price)})` : ''}</li>
                            ))}
                          </ul>
                        )}
                        {/* Inline notes */}
                        <div className="ml-16 mt-1">
                          {editingNotesKey === key ? (
                            <input
                              autoFocus
                              type="text"
                              value={c.notes ?? ''}
                              onChange={(e) => dispatch({ type: 'SET_NOTES', key, notes: e.target.value })}
                              onBlur={() => setEditingNotesKey(null)}
                              placeholder={t('customer.noteHint')}
                              className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-purple-300"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingNotesKey(key)}
                              className="text-xs text-purple-400 hover:text-purple-600"
                            >
                              {c.notes ? `📝 ${c.notes}` : `+ ${t('customer.notePlaceholder')}`}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Promo code */}
                <div className="px-4 py-3 border-t border-gray-100">
                  {promoResult?.valid ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={15} className="text-green-500 shrink-0" />
                        <span className="text-sm font-semibold text-green-700">{promoResult.code}</span>
                        <span className="text-xs text-green-600">−{fmt(promoResult.discountAmount ?? 0)}</span>
                      </div>
                      <button onClick={removePromo} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                          placeholder="Promo code"
                          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-300"
                        />
                      </div>
                      <button
                        onClick={applyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-40"
                      >
                        {promoLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {/* Totals breakdown */}
                  {(discount > 0 || charges.tax > 0) && (
                    <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                      <div className="flex justify-between"><span>{t('customer.subtotal')}</span><span>{fmt(subtotal)}</span></div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600 font-medium"><span>Discount</span><span>−{fmt(discount)}</span></div>
                      )}
                      {charges.tax > 0 && (
                        <div className="flex justify-between"><span>{restaurantInfo?.taxName ?? 'Tax'} ({restaurantInfo?.taxPct}%)</span><span>+{fmt(charges.tax)}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-1"><span>{t('common.total')}</span><span>{fmt(total)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cart button */}
            <button
              onClick={() => cartOpen ? placeOrder() : setCartOpen(true)}
              disabled={placing}
              className="w-full bg-purple-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{itemCount}</span>
              <span className="font-semibold">
                {placing ? t('customer.placingOrder') : cartOpen ? t('customer.placeOrder', { amount: fmt(total) }) : t('customer.yourCart')}
              </span>
              {cartOpen
                ? <ChevronDown size={20} onClick={(e) => { e.stopPropagation(); setCartOpen(false); }} />
                : <ChevronUp size={20} />
              }
            </button>
          </div>
        </div>
      )}

      {toppingModal && (
        <ToppingSelectionModal
          item={toppingModal.item}
          onConfirm={(toppings, size, notes) => {
            dispatch({ type: 'ADD', item: toppingModal.item, size, toppings, notes });
            setToppingModal(null);
          }}
          onClose={() => setToppingModal(null)}
        />
      )}
    </div>
  );
}

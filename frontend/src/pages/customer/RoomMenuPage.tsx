import { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BedDouble, Plus, Minus, Trash2, ChevronUp, ChevronDown, UtensilsCrossed, Tag, CheckCircle, X, Clock, RefreshCw, Search, Package, AlertTriangle } from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import type { SelectedTopping } from '../../types/Order';
import type { CartItem } from '../../types/Order';
import { effectivePrice } from '../../types/MenuItem';
import { menuService } from '../../services/menuService';
import { restaurantService, computeCharges, type RestaurantInfo } from '../../services/restaurantService';
import { orderService } from '../../services/orderService';
import { roomService } from '../../services/roomService';
import { comboService, type Combo } from '../../services/comboService';
import { promoCodeService, type ValidateResult } from '../../services/promoCodeService';
import { CategoryTabs } from '../../components/CategoryTabs';
import { ToppingSelectionModal } from '../../components/ToppingSelectionModal';
import { WelcomeScreen } from '../../components/WelcomeScreen';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useTags } from '../../context/TagsContext';
import { tagPillCls } from '../../services/tagService';
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

export function RoomMenuPage() {
  const { t } = useTranslation();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [roomInfo, setRoomInfo]     = useState<{ number: number; name?: string | null; restaurantId: string } | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [waitTimeMin, setWaitTimeMin]       = useState<number | null>(null);
  const [welcomeInfo, setWelcomeInfo]       = useState<RestaurantInfo | null>(null);
  const [showWelcome, setShowWelcome]       = useState(() => !sessionStorage.getItem(`welcome-seen-room-${roomId}`));

  const [cart, dispatch]            = useReducer(cartReducer, []);
  const [guestName, setGuestName]   = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [cartOpen, setCartOpen]     = useState(false);
  const [rsOpen, setRsOpen]   = useState<string | null>(null);
  const [rsClose, setRsClose] = useState<string | null>(null);
  const [placing, setPlacing]       = useState(false);
  const [toppingModal, setToppingModal] = useState<{ item: MenuItem } | null>(null);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);
  const [promoInput, setPromoInput]   = useState('');
  const [promoResult, setPromoResult] = useState<ValidateResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [combos, setCombos]           = useState<Combo[]>([]);

  const { fmt, loadCurrency } = useCurrency();
  const { loadTheme } = useTheme();
  const { tags: allTags, loadTags } = useTags();

  function loadMenu() {
    if (!roomId) return;
    setLoadError(false);
    setLoading(true);
    roomService.getRoom(roomId)
      .then(async (room) => {
        setRoomInfo({ number: room.number, name: room.name, restaurantId: room.restaurantId });
        loadCurrency(room.restaurantId);
        loadTheme(room.restaurantId);
        loadTags(room.restaurantId);
        comboService.getCombos(room.restaurantId).then((c) => setCombos(c.filter((x) => x.active))).catch(() => {});
        const [info, cats, menuItems] = await Promise.all([
          restaurantService.getRestaurantInfo(room.restaurantId),
          menuService.getCategories(room.restaurantId),
          menuService.getItems(room.restaurantId),
        ]);
        setWelcomeInfo(info);
        setRestaurantName(info?.name ?? '');
        setWaitTimeMin(info?.waitTimeMin ?? null);
        setRsOpen(info?.roomServiceOpen ?? null);
        setRsClose(info?.roomServiceClose ?? null);
        setCategories(cats);
        setItems(menuItems.filter((i) => i.available));
        const reorderItems = (location.state as { reorderItems?: CartItem[] } | null)?.reorderItems;
        if (reorderItems?.length) {
          dispatch({ type: 'INIT', items: reorderItems });
          setCartOpen(true);
          toast.success(`${reorderItems.reduce((s, i) => s + i.quantity, 0)} item(s) added — ready to reorder!`);
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMenu(); }, [roomId]);

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

  // Unique allergens across cart items — for the checkout warning
  const cartAllergens = (() => {
    if (!cart.length) return [];
    const menuMap = new Map(items.map(i => [i.id, i]));
    const slugs = new Set(
      cart.flatMap(c => (menuMap.get(c.menuItemId)?.tags ?? []).filter(slug =>
        allTags.some(t => t.slug === slug && t.category === 'allergen')
      ))
    );
    return allTags.filter(t => t.category === 'allergen' && slugs.has(t.slug));
  })();

  const itemCount  = cart.reduce((s, c) => s + c.quantity, 0);
  const subtotal   = cart.reduce((s, c) => s + (c.price + (c.toppings ?? []).reduce((t, tp) => t + tp.price, 0)) * c.quantity, 0);
  const discount   = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0;
  const taxBase    = Math.max(0, subtotal - discount);
  // Room service: no service charge; tax applies
  const charges    = computeCharges(taxBase, { serviceChargePct: 0, taxPct: welcomeInfo?.taxPct ?? 0 });
  const total      = charges.grandTotal;

  const isRoomServiceOpen = (() => {
    if (!rsOpen || !rsClose) return true;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = rsOpen.split(':').map(Number);
    const [ch, cm] = rsClose.split(':').map(Number);
    const openMin  = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    return openMin <= closeMin ? (cur >= openMin && cur < closeMin) : (cur >= openMin || cur < closeMin);
  })();

  function handleAdd(item: MenuItem) {
    const hasLarge = (item.largePrice ?? 0) > 0;
    const hasToppings = (item.toppings ?? []).some((t) => t.available);
    if (hasLarge || hasToppings) setToppingModal({ item });
    else dispatch({ type: 'ADD', item });
  }

  async function applyPromo() {
    if (!promoInput.trim() || !roomInfo?.restaurantId) return;
    setPromoLoading(true);
    try {
      const result = await promoCodeService.validate(promoInput.trim(), roomInfo.restaurantId, subtotal);
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
    if (cart.length === 0 || !roomInfo) return;
    setPlacing(true);
    try {
      const order = await orderService.placeRoomOrder(
        roomId!, roomInfo.number, cart,
        guestName.trim() || undefined,
        roomInfo.restaurantId,
        promoResult?.valid ? promoResult.code : undefined,
        guestPhone.trim() || undefined,
        chargeToRoom ? 'room-charge' : undefined,
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <BedDouble size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">Could not load the menu</p>
        <p className="text-sm text-gray-400">Check your connection and try again</p>
        <button
          onClick={loadMenu}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={15} /> Try Again
        </button>
      </div>
    );
  }

  if (showWelcome && welcomeInfo) {
    return (
      <WelcomeScreen
        restaurantName={welcomeInfo.name}
        logo={welcomeInfo.logo}
        themeColor={welcomeInfo.themeColor ?? '#3b82f6'}
        heroUrl={welcomeInfo.welcomeImageUrl}
        heading={welcomeInfo.welcomeHeading}
        tagline={welcomeInfo.welcomeTagline || t('customer.scanEnjoy')}
        subtitle={roomInfo ? `${t('customer.room', { number: roomInfo.number })}${roomInfo.name ? ` — ${roomInfo.name}` : ''}` : null}
        waitTimeMin={welcomeInfo.waitTimeMin}
        waitTimeLabel={welcomeInfo.waitTimeMin != null ? t('customer.waitTime', { n: welcomeInfo.waitTimeMin }) : undefined}
        social={welcomeInfo}
        followUsLabel={t('customer.followUs')}
        ctaLabel={t('customer.viewMenu')}
        poweredByLabel={t('customer.poweredBy')}
        onEnter={() => {
          sessionStorage.setItem(`welcome-seen-room-${roomId}`, '1');
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
            <BedDouble size={20} className="text-blue-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {restaurantName || t('customer.roomService')}
              </h1>
              <p className="text-sm text-blue-600 font-medium">
                {t('customer.room', { number: roomInfo?.number })}{roomInfo?.name ? ` — ${roomInfo.name}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-gray-400">{t('customer.searchMenu')}</p>
            {waitTimeMin && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock size={11} /> {t('customer.waitTime', { n: waitTimeMin })}
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
              className="w-full bg-gray-100 rounded-full pl-9 pr-9 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-300 transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Room service closed banner */}
      {!isRoomServiceOpen && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex items-start gap-3">
            <Clock size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Room service is currently closed</p>
              {rsOpen && rsClose && (
                <p className="text-xs text-red-500 mt-0.5">Available {rsOpen} – {rsClose}</p>
              )}
              <p className="text-xs text-red-400 mt-1">You can still browse the menu, but orders cannot be placed right now.</p>
            </div>
          </div>
        </div>
      )}

      {/* Menu grid */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* Combos & Deals strip */}
        {combos.length > 0 && (
          <section className="mb-5">
            <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package size={14} /> {t('customer.combosAndDeals')}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {combos.map((combo) => (
                <div key={combo.id} className="shrink-0 w-52 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
                  {combo.image
                    ? <img src={combo.image} alt={combo.name} className="w-full h-28 object-cover" />
                    : <div className="w-full h-28 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"><Package size={32} className="text-blue-300" /></div>}
                  <div className="p-3">
                    <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{combo.name}</p>
                    {combo.description && <p className="text-xs text-gray-400 line-clamp-1 mb-1">{combo.description}</p>}
                    {combo.items.length > 0 && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {combo.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.menuItemName}`).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-bold text-base">{fmt(combo.price)}</span>
                      <button
                        onClick={() => dispatch({ type: 'ADD_COMBO', comboId: combo.id, name: combo.name, price: combo.price, comboItems: combo.items.map((i) => i.menuItemName) })}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-blue-700 active:scale-95 transition-all"
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
              const regPrice = effectivePrice(item, 'regular');
              const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
              const regDisc  = item.discountPct > 0;
              const totalInCart = cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);

              return (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${totalInCart > 0 ? 'border-blue-200' : 'border-gray-100'}`}>
                  <div className="relative">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-full h-36 object-cover" />
                      : <div className="w-full h-36 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"><UtensilsCrossed size={32} className="text-blue-300" /></div>}
                    {regDisc && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{item.discountPct}% OFF</span>
                    )}
                    {(hasToppings || hasLarge) && (
                      <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {hasToppings ? `+ ${t('customer.extras')}` : 'R / L'}
                      </span>
                    )}
                    {item.trackStock && item.stock != null && item.stock <= 5 && (
                      <span className={`absolute bottom-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${item.stock <= 2 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
                        Only {item.stock} left
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {(item.tags ?? []).some(slug => allTags.some(t => t.slug === slug && t.category === 'allergen')) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(item.tags ?? []).flatMap(slug => {
                          const tag = allTags.find(t => t.slug === slug && t.category === 'allergen');
                          return tag ? [tag] : [];
                        }).map(tag => (
                          <span key={tag.slug} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tagPillCls('allergen')}`}>
                            {tag.emoji} {tag.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">{item.description}</p>}
                    <div className="mt-2">
                      {regDisc
                        ? <div><span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span><span className="ml-1.5 text-green-600 font-bold">{fmt(regPrice)}</span></div>
                        : <span className="text-blue-600 font-bold">{fmt(regPrice)}</span>}
                      {hasLarge && <span className="text-xs text-gray-400 ml-1">/ L {fmt(lrgPrice)}</span>}
                      <div className="mt-2">
                        <button
                          onClick={() => handleAdd(item)}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${totalInCart > 0 ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
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

      {/* Floating cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-lg mx-auto px-4 pb-4">
            {cartOpen && (
              <div className="bg-white rounded-t-3xl shadow-2xl border border-gray-100 max-h-[60vh] flex flex-col">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 mb-2">{t('customer.yourCart')}</p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('customer.notePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-300 mb-1"
                  />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder={t('customer.phonePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
                  />
                  {/* Charge to Room toggle */}
                  <label className={`flex items-center gap-3 mt-1 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${chargeToRoom ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div
                      onClick={() => setChargeToRoom((p) => !p)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${chargeToRoom ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chargeToRoom ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${chargeToRoom ? 'text-blue-700' : 'text-gray-600'}`}>Charge to Room</p>
                      <p className="text-xs text-gray-400">Bill will be added to your room account</p>
                    </div>
                  </label>
                </div>
                <ul className="overflow-y-auto flex-1 divide-y divide-gray-50 px-4">
                  {cart.map((c) => {
                    const key = cartKey(c.menuItemId, c.size, c.toppings);
                    const toppingsTotal = (c.toppings ?? []).reduce((s, t) => s + t.price, 0);
                    return (
                      <li key={key} className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => dispatch({ type: 'DEC', key })} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Minus size={12} /></button>
                            <span className="w-5 text-center font-bold text-gray-900 text-sm">{c.quantity}</span>
                            <button onClick={() => dispatch({ type: 'INC', key })} className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200"><Plus size={12} /></button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{c.name}</span>
                            {c.comboId && <span className="text-xs bg-blue-500 text-white font-semibold px-1.5 py-0.5 rounded-full">{t('customer.bundle')}</span>}
                            {c.size && <span className="text-xs text-blue-500 capitalize">{c.size}</span>}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 shrink-0">{fmt((c.price + toppingsTotal) * c.quantity)}</span>
                          <button onClick={() => dispatch({ type: 'REMOVE', key })} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
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
                              className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingNotesKey(key)}
                              className="text-xs text-blue-400 hover:text-blue-600"
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
                          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-300"
                        />
                      </div>
                      <button
                        onClick={applyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        {promoLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {(discount > 0 || charges.tax > 0) && (
                    <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                      <div className="flex justify-between"><span>{t('customer.subtotal')}</span><span>{fmt(subtotal)}</span></div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600 font-medium"><span>Discount</span><span>−{fmt(discount)}</span></div>
                      )}
                      {charges.tax > 0 && (
                        <div className="flex justify-between"><span>{welcomeInfo?.taxName ?? 'Tax'} ({welcomeInfo?.taxPct}%)</span><span>+{fmt(charges.tax)}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-1"><span>{t('common.total')}</span><span>{fmt(total)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Allergen warning — shown when cart is open */}
            {cartOpen && cartAllergens.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2 mb-2">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800">Your order contains allergens</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    {cartAllergens.map(t => `${t.emoji} ${t.label}`).join(' · ')}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => cartOpen ? placeOrder() : setCartOpen(true)}
              disabled={placing || (cartOpen && !isRoomServiceOpen)}
              className="w-full bg-blue-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{itemCount}</span>
              <span className="font-semibold">
                {placing ? t('customer.placingOrder') : cartOpen && !isRoomServiceOpen ? t('customer.roomService') : cartOpen ? t('customer.placeOrder', { amount: fmt(total) }) : t('customer.yourCart')}
              </span>
              {cartOpen
                ? <ChevronDown size={20} onClick={(e) => { e.stopPropagation(); setCartOpen(false); }} />
                : <ChevronUp size={20} />}
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

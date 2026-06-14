import { useEffect, useReducer, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BedDouble, Plus, Minus, Trash2, ChevronUp, ChevronDown,
  UtensilsCrossed, Tag, CheckCircle, X, Clock, RefreshCw, Search,
  Package, AlertTriangle, LayoutGrid, List, Heart, Flame,
} from 'lucide-react';
import { ProductDetailModal } from '../../components/ProductDetailModal';
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
import { WelcomeScreen } from '../../components/WelcomeScreen';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useTags } from '../../context/TagsContext';
import { useFavourites } from '../../hooks/useFavourites';
import toast from 'react-hot-toast';
import { ActiveOrderBanner, saveActiveOrder } from '../../components/ActiveOrderBanner';

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

/* ── Item card (grid) ─────────────────────────────────────────────────── */
function GridCard({ item, fmt, totalInCart, onOpen, onAdd, isFavourite, onToggleFavourite }: {
  item: MenuItem; fmt: (n: number) => string; totalInCart: number;
  onOpen: (item: MenuItem) => void; onAdd: (item: MenuItem) => void;
  isFavourite: boolean; onToggleFavourite: (id: string) => void;
}) {
  const hasLarge    = (item.largePrice ?? 0) > 0;
  const hasToppings = (item.toppings ?? []).some((t) => t.available);
  const regPrice    = effectivePrice(item, 'regular');
  const lrgPrice    = hasLarge ? effectivePrice(item, 'large') : 0;
  const regDisc     = item.discountPct > 0;
  const lrgDisc     = (item.largeDiscountPct ?? 0) > 0;
  const isLowStock  = item.trackStock && item.available && item.stock != null && item.stock > 0 && item.stock <= 5;

  return (
    <div
      onClick={() => onOpen(item)}
      className={`bg-white rounded-3xl shadow-md overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-all duration-200 ${totalInCart > 0 ? 'ring-2 ring-orange-400' : ''}`}
    >
      <div className="relative flex-none">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-48 object-cover" />
          : <div className="w-full h-48 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center"><UtensilsCrossed size={48} className="text-orange-200" /></div>}
        {(regDisc || lrgDisc) && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            {regDisc ? item.discountPct : item.largeDiscountPct}% OFF
          </span>
        )}
        {isLowStock && (
          <span className={`absolute ${regDisc || lrgDisc ? 'top-10 mt-1' : 'top-3'} left-3 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${item.stock! <= 2 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
            <Flame size={10} /> {item.stock} left
          </span>
        )}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavourite(item.id); }}
            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow transition-colors hover:bg-white"
          >
            <Heart size={13} className={isFavourite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          </button>
          {(hasToppings || hasLarge) && (
            <span className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {hasToppings ? '+ Extras' : 'R / L'}
            </span>
          )}
        </div>
      </div>
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>
        {(item.calories || item.proteinG != null || item.spiceLevel != null) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.calories ? <span className="flex items-center gap-0.5 text-[11px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">🔥 {item.calories} kcal</span> : null}
            {item.proteinG != null ? <span className="flex items-center gap-0.5 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">💪 {item.proteinG}g</span> : null}
            {item.spiceLevel != null ? <span className="flex items-center gap-0.5 text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">🌶 {item.spiceLevel}/5</span> : null}
          </div>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div>
            {regDisc && <span className="block text-xs text-gray-400 line-through leading-none">{fmt(item.price)}</span>}
            <span className={`text-xl font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>{fmt(regPrice)}</span>
            {hasLarge && <span className="text-xs text-gray-400 ml-1">/ L {fmt(lrgPrice)}</span>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(item); }}
            disabled={!item.available}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 ${
              !item.available ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              : totalInCart > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
              : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {totalInCart > 0 ? <span className="text-sm font-bold">{totalInCart}</span> : <Plus size={20} />}
          </button>
        </div>
        {!item.available && <p className="text-xs text-red-400 mt-1">Unavailable</p>}
      </div>
    </div>
  );
}

/* ── Item card (list) ─────────────────────────────────────────────────── */
function ListCard({ item, fmt, totalInCart, onOpen, onAdd, isFavourite, onToggleFavourite }: {
  item: MenuItem; fmt: (n: number) => string; totalInCart: number;
  onOpen: (item: MenuItem) => void; onAdd: (item: MenuItem) => void;
  isFavourite: boolean; onToggleFavourite: (id: string) => void;
}) {
  const hasLarge = (item.largePrice ?? 0) > 0;
  const regPrice = effectivePrice(item, 'regular');
  const lrgPrice = hasLarge ? effectivePrice(item, 'large') : 0;
  const regDisc  = item.discountPct > 0;
  const lrgDisc  = (item.largeDiscountPct ?? 0) > 0;

  return (
    <div
      onClick={() => onOpen(item)}
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all ${!item.available ? 'opacity-60' : ''}`}
    >
      <div className="relative shrink-0">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-2xl" />
          : <div className="w-16 h-16 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl flex items-center justify-center"><UtensilsCrossed size={22} className="text-orange-300" /></div>}
        {(regDisc || lrgDisc) && (
          <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
            {regDisc ? item.discountPct : item.largeDiscountPct}%
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-gray-900 text-sm leading-tight block">{item.name}</span>
        <div className="flex items-baseline gap-1 mt-1">
          {regDisc && <span className="text-[11px] text-gray-400 line-through">{fmt(item.price)}</span>}
          <span className={`text-sm font-bold ${regDisc ? 'text-green-600' : 'text-orange-600'}`}>{fmt(regPrice)}</span>
          {hasLarge && <span className="text-[11px] text-gray-400">/ L {fmt(lrgPrice)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(item.id); }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-red-50"
        >
          <Heart size={15} className={isFavourite ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(item); }}
          disabled={!item.available}
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold transition-colors ${
            !item.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : totalInCart > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
            : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {totalInCart > 0 ? <span className="text-xs font-bold">{totalInCart}</span> : <Plus size={16} />}
        </button>
      </div>
    </div>
  );
}

export function RoomMenuPage() {
  const { t } = useTranslation();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [roomInfo, setRoomInfo]     = useState<{ number: number; name?: string | null; restaurantId: string } | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [waitTimeMin, setWaitTimeMin]       = useState<number | null>(null);
  const [welcomeInfo, setWelcomeInfo]       = useState<RestaurantInfo | null>(null);
  const [showWelcome, setShowWelcome]       = useState(() => !sessionStorage.getItem(`welcome-seen-room-${roomId}`));
  const [view, setView] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('qra_menu_view') as 'grid' | 'list' | null) ?? 'grid'
  );
  const [combosOpen, setCombosOpen] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const { isFavourite, toggle: toggleFavourite, favourites } = useFavourites(roomInfo?.restaurantId ?? '');

  const [cart, dispatch]            = useReducer(cartReducer, []);
  const [guestName, setGuestName]   = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [cartOpen, setCartOpen]     = useState(false);
  const [rsOpen, setRsOpen]         = useState<string | null>(null);
  const [rsClose, setRsClose]       = useState<string | null>(null);
  const [placing, setPlacing]       = useState(false);
  const [detailModal, setDetailModal] = useState<MenuItem | null>(null);
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
  const baseFiltered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
    : catFiltered;
  const filtered = showFavourites ? baseFiltered.filter((i) => isFavourite(i.id)) : baseFiltered;

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
    if (hasLarge || hasToppings) setDetailModal(item);
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

  function removePromo() { setPromoResult(null); setPromoInput(''); }

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
      setPromoResult(null); setPromoInput(''); setCartOpen(false);
      saveActiveOrder(order.id, order.orderNumber, roomInfo.restaurantId);
      navigate(`/order-success/${order.id}`);
    } catch {
      toast.error(t('customer.failedOrder'));
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <BedDouble size={40} className="text-gray-300" />
      <p className="text-gray-500 font-medium">Could not load the menu</p>
      <p className="text-sm text-gray-400">Check your connection and try again</p>
      <button onClick={loadMenu} className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-600 transition-colors">
        <RefreshCw size={15} /> Try Again
      </button>
    </div>
  );

  if (showWelcome && welcomeInfo) return (
    <WelcomeScreen
      restaurantName={welcomeInfo.name}
      logo={welcomeInfo.logo}
      themeColor={welcomeInfo.themeColor ?? '#2a7344'}
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
      onEnter={() => { sessionStorage.setItem(`welcome-seen-room-${roomId}`, '1'); setShowWelcome(false); }}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BedDouble size={20} className="text-orange-500" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{restaurantName || t('customer.roomService')}</h1>
                <p className="text-xs text-gray-500">
                  {t('customer.room', { number: roomInfo?.number })}{roomInfo?.name ? ` — ${roomInfo.name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                <button
                  onClick={() => { setView('grid'); localStorage.setItem('qra_menu_view', 'grid'); }}
                  className={`p-1.5 rounded-full transition-colors ${view === 'grid' ? 'bg-white shadow text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                  title={t('customer.gridView')}
                ><LayoutGrid size={14} /></button>
                <button
                  onClick={() => { setView('list'); localStorage.setItem('qra_menu_view', 'list'); }}
                  className={`p-1.5 rounded-full transition-colors ${view === 'list' ? 'bg-white shadow text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                  title={t('customer.listView')}
                ><List size={14} /></button>
              </div>
            </div>
          </div>
          {waitTimeMin && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full w-fit mt-1">
              <Clock size={11} /> {t('customer.waitTime', { n: waitTimeMin })}
            </span>
          )}
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('customer.searchMenu')}
              className="w-full bg-gray-100 rounded-full pl-9 pr-9 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-300 transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFavourites((s) => !s)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
              showFavourites ? 'bg-red-500 text-white shadow-sm shadow-red-200' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <Heart size={13} className={showFavourites ? 'fill-white' : ''} />
            {favourites.size > 0 && <span>{favourites.size}</span>}
          </button>
        </div>
      </header>

      {/* Room service closed banner */}
      {!isRoomServiceOpen && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 flex items-start gap-3">
            <Clock size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">Room service is currently closed</p>
              {rsOpen && rsClose && <p className="text-xs text-red-500 mt-0.5">Available {rsOpen} – {rsClose}</p>}
              <p className="text-xs text-red-400 mt-1">You can still browse the menu, but orders cannot be placed right now.</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-4">
        {/* Combos & Deals — collapsible */}
        {combos.length > 0 && (
          <section className="mb-5">
            <button
              onClick={() => setCombosOpen((o) => !o)}
              className="w-full flex items-center justify-between py-2 px-0 group"
            >
              <span className="text-sm font-bold text-orange-600 uppercase tracking-wide flex items-center gap-1.5">
                <Package size={14} /> {t('customer.combosAndDeals')}
                <span className="ml-1.5 text-xs font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                  {combos.length}
                </span>
              </span>
              <ChevronDown size={16} className={`text-orange-400 transition-transform duration-200 ${combosOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${combosOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="flex gap-3 overflow-x-auto pb-1 pt-1 -mx-1 px-1">
                {combos.map((combo) => (
                  <div key={combo.id} className="shrink-0 w-52 bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                    {combo.image
                      ? <img src={combo.image} alt={combo.name} className="w-full h-28 object-cover" />
                      : <div className="w-full h-28 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center"><Package size={32} className="text-orange-300" /></div>}
                    <div className="p-3">
                      <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{combo.name}</p>
                      {combo.description && <p className="text-xs text-gray-400 line-clamp-1 mb-1">{combo.description}</p>}
                      {combo.items.length > 0 && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                          {combo.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.menuItemName}`).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-orange-600 font-bold text-base">{fmt(combo.price)}</span>
                        <button
                          onClick={() => dispatch({ type: 'ADD_COMBO', comboId: combo.id, name: combo.name, price: combo.price, comboItems: combo.items.map((i) => i.menuItemName) })}
                          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-orange-600 active:scale-95 transition-all"
                        >
                          {t('customer.addToCart')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {filtered.length === 0 ? (
          <div className="text-center mt-12">
            {showFavourites && favourites.size === 0 ? (
              <>
                <Heart size={36} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No favourites yet</p>
                <p className="text-gray-300 text-xs mt-1">Tap the ♡ on any item to save it here</p>
              </>
            ) : (
              <p className="text-gray-400">{q ? t('customer.noItemsMatch', { query: searchQuery }) : t('customer.noItemsCategory')}</p>
            )}
          </div>
        ) : view === 'list' ? (
          <div className="flex flex-col gap-2">
            {filtered.map((item) => (
              <ListCard
                key={item.id}
                item={item}
                fmt={fmt}
                totalInCart={cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                onOpen={setDetailModal}
                onAdd={handleAdd}
                isFavourite={isFavourite(item.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <GridCard
                key={item.id}
                item={item}
                fmt={fmt}
                totalInCart={cart.filter((c) => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                onOpen={setDetailModal}
                onAdd={handleAdd}
                isFavourite={isFavourite(item.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-5xl mx-auto px-4 pb-4">
            {cartOpen && (
              <div className="bg-white rounded-t-3xl shadow-2xl border border-gray-100 max-h-[60vh] flex flex-col">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 mb-2">{t('customer.yourCart')}</p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('customer.notePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300 mb-1"
                  />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder={t('customer.phonePlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-300"
                  />
                  <label className={`flex items-center gap-3 mt-1 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${chargeToRoom ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div
                      onClick={() => setChargeToRoom((p) => !p)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${chargeToRoom ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chargeToRoom ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${chargeToRoom ? 'text-orange-700' : 'text-gray-600'}`}>Charge to Room</p>
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
                            <button onClick={() => dispatch({ type: 'INC', key })} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200"><Plus size={12} /></button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{c.name}</span>
                            {c.comboId && <span className="text-xs bg-orange-500 text-white font-semibold px-1.5 py-0.5 rounded-full">{t('customer.bundle')}</span>}
                            {c.size && <span className="text-xs text-orange-500 capitalize">{c.size}</span>}
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
                        <div className="ml-16 mt-1">
                          {editingNotesKey === key ? (
                            <input
                              autoFocus
                              type="text"
                              value={c.notes ?? ''}
                              onChange={(e) => dispatch({ type: 'SET_NOTES', key, notes: e.target.value })}
                              onBlur={() => setEditingNotesKey(null)}
                              placeholder={t('customer.noteHint')}
                              className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-300"
                            />
                          ) : (
                            <button onClick={() => setEditingNotesKey(key)} className="text-xs text-orange-400 hover:text-orange-600">
                              {c.notes ? `📝 ${c.notes}` : `+ ${t('customer.notePlaceholder')}`}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-3 border-t border-gray-100">
                  {promoResult?.valid ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={15} className="text-green-500 shrink-0" />
                        <span className="text-sm font-semibold text-green-700">{promoResult.code}</span>
                        <span className="text-xs text-green-600">−{fmt(promoResult.discountAmount ?? 0)}</span>
                      </div>
                      <button onClick={removePromo} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
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
                          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-300"
                        />
                      </div>
                      <button
                        onClick={applyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-40"
                      >
                        {promoLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {(discount > 0 || charges.tax > 0) && (
                    <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                      <div className="flex justify-between"><span>{t('customer.subtotal')}</span><span>{fmt(subtotal)}</span></div>
                      {discount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount</span><span>−{fmt(discount)}</span></div>}
                      {charges.tax > 0 && <div className="flex justify-between"><span>{welcomeInfo?.taxName ?? 'Tax'} ({welcomeInfo?.taxPct}%)</span><span>+{fmt(charges.tax)}</span></div>}
                      <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-1"><span>{t('common.total')}</span><span>{fmt(total)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              className="w-full bg-orange-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
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

      {detailModal && (
        <ProductDetailModal
          item={detailModal}
          onClose={() => setDetailModal(null)}
          onAdd={(toppings, size, notes, qty) => {
            for (let i = 0; i < qty; i++) {
              dispatch({ type: 'ADD', item: detailModal, size, toppings, notes: i === 0 ? (notes || undefined) : undefined });
            }
          }}
        />
      )}

      <ActiveOrderBanner restaurantId={roomInfo?.restaurantId ?? ''} hidden={cartOpen} />
    </div>
  );
}

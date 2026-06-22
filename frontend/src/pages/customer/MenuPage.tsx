import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Category, MenuItem } from '../../types';
import { menuService } from '../../services/menuService';
import { tableService } from '../../services/tableService';
import { restaurantService } from '../../services/restaurantService';
import { CategoryTabs } from '../../components/CategoryTabs';
import { MenuCard } from '../../components/MenuCard';
import { CartButton } from '../../components/CartButton';
import { useCart } from '../../context/CartContext';
import { sessionService } from '../../services/sessionService';
import { useCurrency } from '../../context/CurrencyContext';
import { useTags } from '../../context/TagsContext';

import { menuScheduleService, isScheduleNowActive } from '../../services/menuScheduleService';
import type { MenuSchedule } from '../../services/menuScheduleService';
import { comboService, type Combo } from '../../services/comboService';
import { UtensilsCrossed, ClipboardList, RefreshCw, Clock, Search, X, LayoutGrid, List, Package, ChevronDown, Heart, ShoppingCart, Trash2, Receipt, MoreVertical, Check } from 'lucide-react';
import { useFavourites } from '../../hooks/useFavourites';
import { menuPrefetchCache } from '../../services/menuPrefetchCache';
import { ActiveOrderBanner } from '../../components/ActiveOrderBanner';
import { Button } from '../../components/Button';
import { pushEscape } from '../../lib/escapeStack';
export function MenuPage() {
  const { t } = useTranslation();
  const { tableId: tableIdParam } = useParams<{ tableId: string }>();
  const { setTable, setSession, setRestaurant, tableNumber, tableId, sessionId, addCombo,
          checkForSavedCart, restoreCart, discardCart, pendingSavedCart, items: cartItems } = useCart();
  const { loadCurrency, fmt } = useCurrency();
  const { loadTags } = useTags();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, _setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; logo: string | null; waitTimeMin: number | null } | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('qra_menu_view') as 'grid' | 'list' | null) ?? 'grid'
  );
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [combosOpen, setCombosOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [showFavourites, setShowFavourites] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const { isFavourite, toggle: toggleFavourite, favourites } = useFavourites(restaurantId);

  function loadMenu() {
    if (!tableIdParam) return;
    setError(false);
    setLoading(true);

    // Use prefetch cache if WelcomePage already fetched everything
    const cached = menuPrefetchCache.get(tableIdParam);
    if (cached) {
      menuPrefetchCache.clear(tableIdParam);
      setTable(cached.tableId, cached.tableNumber);
      checkForSavedCart(cached.tableId);
      setRestaurant(cached.restaurantId);
      setRestaurantId(cached.restaurantId);
      loadCurrency(cached.restaurantId);
      loadTags(cached.restaurantId);
      setRestaurantInfo(cached.restaurantInfo);
      setCategories(cached.categories);
      setItems(cached.items);
      setSession(cached.sessionId);
      localStorage.setItem(`qra_session_${cached.tableId}`, cached.sessionId);
      // Load schedules + combos in background (non-blocking)
      menuScheduleService.getSchedules(cached.restaurantId).then(setSchedules).catch(() => {});
      comboService.getCombos(cached.restaurantId).then((c) => setCombos(c.filter((x) => x.active))).catch(() => {});
      setLoading(false);
      return;
    }

    // Fallback: fetch everything fresh (direct navigation / hard reload)
    tableService.getTable(tableIdParam).then((table) => {
      setTable(table.id, table.number);
      checkForSavedCart(table.id);
      setRestaurant(table.restaurantId);
      setRestaurantId(table.restaurantId);
      loadCurrency(table.restaurantId);
      loadTags(table.restaurantId);
      restaurantService.getRestaurantInfo(table.restaurantId).then(setRestaurantInfo).catch(() => {});
      menuScheduleService.getSchedules(table.restaurantId).then(setSchedules).catch(() => {});
      comboService.getCombos(table.restaurantId).then((c) => setCombos(c.filter((x) => x.active))).catch(() => {});
      return Promise.all([
        menuService.getCategories(table.restaurantId),
        menuService.getItems(table.restaurantId),
        sessionService.getOrCreate(table.id, table.number, table.restaurantId),
      ]).then(([cats, menuItems, session]) => {
        setCategories(cats);
        setItems(menuItems);
        setSession(session.id);
        localStorage.setItem(`qra_session_${table.id}`, session.id);
        setLoading(false);
      });
    }).catch(() => {
      setLoading(false);
      setError(true);
    });
  }

  useEffect(() => { loadMenu(); }, [tableIdParam]);

  // Close the header overflow menu on Escape (shared overlay stack)
  useEffect(() => {
    if (!headerMenuOpen) return;
    return pushEscape(() => setHeaderMenuOpen(false));
  }, [headerMenuOpen]);

  // Build schedule lookup map
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  // Returns true if this item should be shown right now based on its schedule
  function isItemVisible(scheduleId?: string | null): boolean {
    if (!scheduleId) return true;
    const sch = scheduleMap.get(scheduleId);
    if (!sch) return true; // unknown schedule → always show
    return isScheduleNowActive(sch);
  }

  // Visible items: filter out items whose schedule is not currently active
  const visibleItems = items.filter((i) => isItemVisible(i.scheduleId));

  const q = searchQuery.trim().toLowerCase();
  const catFiltered = activeCategory === 'all' ? visibleItems : visibleItems.filter((i) => i.category === activeCategory);
  const tagFiltered = activeTag ? catFiltered.filter((i) => (i.tags ?? []).includes(activeTag)) : catFiltered;
  const baseFiltered = q
    ? visibleItems
        .filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
        .filter((i) => (activeTag ? (i.tags ?? []).includes(activeTag) : true))
    : tagFiltered;
  const filtered = showFavourites ? baseFiltered.filter((i) => isFavourite(i.id)) : baseFiltered;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <UtensilsCrossed size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">{t('common.errorLoadMenu')}</p>
        <p className="text-sm text-gray-400">{t('common.errorCheckConnection')}</p>
        <Button onClick={loadMenu} leftIcon={<RefreshCw size={15} />}>
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {restaurantInfo?.logo
                ? <img src={restaurantInfo.logo} alt="logo" className="w-8 h-8 object-contain rounded-md shrink-0" />
                : <UtensilsCrossed size={20} className="text-orange-500 shrink-0" />}
              <h1 className="text-xl font-bold text-gray-900 truncate">{restaurantInfo?.name ?? 'Menu'}</h1>
            </div>

            {/* Overflow menu — keeps the mobile header uncluttered */}
            <div className="relative shrink-0">
              <button
                onClick={() => setHeaderMenuOpen((o) => !o)}
                aria-label={t('customer.moreOptions')}
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
                className="p-2 -mr-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              {headerMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden py-1.5">
                    <button
                      role="menuitemradio"
                      aria-checked={view === 'grid'}
                      onClick={() => { setView('grid'); localStorage.setItem('qra_menu_view', 'grid'); setHeaderMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'grid' ? 'text-orange-600 bg-orange-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <LayoutGrid size={16} /> {t('customer.gridView')}
                      {view === 'grid' && <Check size={15} className="ml-auto" />}
                    </button>
                    <button
                      role="menuitemradio"
                      aria-checked={view === 'list'}
                      onClick={() => { setView('list'); localStorage.setItem('qra_menu_view', 'list'); setHeaderMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${view === 'list' ? 'text-orange-600 bg-orange-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <List size={16} /> {t('customer.listView')}
                      {view === 'list' && <Check size={15} className="ml-auto" />}
                    </button>

                    {(sessionId || tableId) && <div className="h-px bg-gray-100 my-1.5" />}

                    {sessionId && (
                      <Link
                        role="menuitem"
                        to={`/bill/${sessionId}`}
                        onClick={() => setHeaderMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Receipt size={16} className="text-orange-500" /> {t('bill.viewBill')}
                      </Link>
                    )}
                    {tableId && (
                      <Link
                        role="menuitem"
                        to={`/order-history/${tableId}`}
                        onClick={() => setHeaderMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <ClipboardList size={16} className="text-orange-500" /> {t('orderHistory.title')}
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-500">{t('customer.tableNumber', { number: tableNumber })}</p>
            {restaurantInfo?.waitTimeMin && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock size={11} /> {t('customer.waitTime', { n: restaurantInfo.waitTimeMin })}
              </span>
            )}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>
        {/* Search bar + Favourites toggle */}
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
              showFavourites
                ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <Heart size={13} className={showFavourites ? 'fill-white' : ''} />
            {favourites.size > 0 && <span>{favourites.size}</span>}
          </button>
        </div>
      </header>

      {/* ── Continue your order? banner ───────────────────────────────────── */}
      {pendingSavedCart && cartItems.length === 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <ShoppingCart size={18} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-800 leading-tight">Continue your order?</p>
              <p className="text-xs text-orange-600 mt-0.5">
                {pendingSavedCart.items.reduce((s, i) => s + i.quantity, 0)} item
                {pendingSavedCart.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''} saved
                {' · '}{fmt(pendingSavedCart.total)}
              </p>
            </div>
            <button
              onClick={() => { restoreCart(); }}
              className="shrink-0 bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-orange-600 active:scale-95 transition-all"
            >
              Continue
            </button>
            <button
              onClick={() => discardCart()}
              className="shrink-0 text-orange-400 hover:text-orange-600 transition-colors"
              title="Start fresh"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-4">
        {/* Combos & Deals strip — collapsible */}
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
              <ChevronDown
                size={16}
                className={`text-orange-400 transition-transform duration-200 ${combosOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${combosOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="flex gap-3 overflow-x-auto pb-1 pt-1 -mx-1 px-1">
                {combos.map((combo) => (
                  <div
                    key={combo.id}
                    className="shrink-0 w-52 bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden"
                  >
                    {combo.image ? (
                      <img src={combo.image} alt={combo.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
                        <Package size={32} className="text-orange-300" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{combo.name}</p>
                      {combo.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1">{combo.description}</p>
                      )}
                      {combo.items.length > 0 && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                          {combo.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.menuItemName}`).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-orange-600 font-bold text-base">{fmt(combo.price)}</span>
                        <button
                          onClick={() => {
                            addCombo(combo.id, combo.name, combo.price, combo.items.map((i) => i.menuItemName));
                          }}
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
              <MenuCard key={item.id} item={item} view="list"
                categoryName={categories.find((c) => c.id === item.category)?.name}
                isFavourite={isFavourite(item.id)}
                onToggleFavourite={restaurantId ? toggleFavourite : undefined} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} view="grid"
                categoryName={categories.find((c) => c.id === item.category)?.name}
                isFavourite={isFavourite(item.id)}
                onToggleFavourite={restaurantId ? toggleFavourite : undefined} />
            ))}
          </div>
        )}
      </main>

      <CartButton />
      <ActiveOrderBanner restaurantId={restaurantId} orderType="dine-in" />
    </div>
  );
}

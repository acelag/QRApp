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
import { useTheme } from '../../context/ThemeContext';
import { useTags } from '../../context/TagsContext';
import { tagPillCls } from '../../services/tagService';
import { menuScheduleService, isScheduleNowActive } from '../../services/menuScheduleService';
import type { MenuSchedule } from '../../services/menuScheduleService';
import { comboService, type Combo } from '../../services/comboService';
import { UtensilsCrossed, ClipboardList, RefreshCw, Clock, Search, X, LayoutGrid, List, Package, ChevronDown } from 'lucide-react';
import { menuPrefetchCache } from '../../services/menuPrefetchCache';
export function MenuPage() {
  const { t } = useTranslation();
  const { tableId: tableIdParam } = useParams<{ tableId: string }>();
  const { setTable, setSession, setRestaurant, tableNumber, tableId, addCombo } = useCart();
  const { loadCurrency, fmt } = useCurrency();
  const { loadTheme } = useTheme();
  const { tags: allTags, loadTags } = useTags();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
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

  function loadMenu() {
    if (!tableIdParam) return;
    setError(false);
    setLoading(true);

    // Use prefetch cache if WelcomePage already fetched everything
    const cached = menuPrefetchCache.get(tableIdParam);
    if (cached) {
      menuPrefetchCache.clear(tableIdParam);
      setTable(cached.tableId, cached.tableNumber);
      setRestaurant(cached.restaurantId);
      loadCurrency(cached.restaurantId);
      loadTheme(cached.restaurantId);
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
      setRestaurant(table.restaurantId);
      loadCurrency(table.restaurantId);
      loadTheme(table.restaurantId);
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
  const filtered = q
    ? visibleItems
        .filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
        .filter((i) => (activeTag ? (i.tags ?? []).includes(activeTag) : true))
    : tagFiltered;
  // Only show tag chips for tags that exist on at least one visible menu item
  const presentSlugs = new Set(visibleItems.flatMap((i) => i.tags ?? []));
  const visibleTags = allTags.filter((t) => presentSlugs.has(t.slug));

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
        <button
          onClick={loadMenu}
          className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <RefreshCw size={15} /> {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {restaurantInfo?.logo
                ? <img src={restaurantInfo.logo} alt="logo" className="w-8 h-8 object-contain rounded-md" />
                : <UtensilsCrossed size={20} className="text-orange-500" />}
              <h1 className="text-xl font-bold text-gray-900">{restaurantInfo?.name ?? 'Menu'}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Grid / List toggle */}
              <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                <button
                  onClick={() => { setView('grid'); localStorage.setItem('qra_menu_view', 'grid'); }}
                  className={`p-1.5 rounded-full transition-colors ${view === 'grid' ? 'bg-white shadow text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                  title={t('customer.gridView')}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => { setView('list'); localStorage.setItem('qra_menu_view', 'list'); }}
                  className={`p-1.5 rounded-full transition-colors ${view === 'list' ? 'bg-white shadow text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                  title={t('customer.listView')}
                >
                  <List size={14} />
                </button>
              </div>
              {tableId && (
                <Link
                  to={`/order-history/${tableId}`}
                  className="flex items-center gap-1.5 text-xs text-orange-500 font-medium bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
                >
                  <ClipboardList size={13} />
                  {t('orderHistory.title')}
                </Link>
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
        {/* Search bar */}
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <div className="relative">
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
        </div>
      </header>

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
          <p className="text-center text-gray-400 mt-12">
            {q ? t('customer.noItemsMatch', { query: searchQuery }) : t('customer.noItemsCategory')}
          </p>
        ) : view === 'list' ? (
          <div className="flex flex-col gap-2">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} view="list"
                categoryName={categories.find((c) => c.id === item.category)?.name} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} view="grid"
                categoryName={categories.find((c) => c.id === item.category)?.name} />
            ))}
          </div>
        )}
      </main>

      <CartButton />
    </div>
  );
}

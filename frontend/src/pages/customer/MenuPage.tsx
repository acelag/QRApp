import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { UtensilsCrossed, ClipboardList, RefreshCw, Clock } from 'lucide-react';
export function MenuPage() {
  const { tableId: tableIdParam } = useParams<{ tableId: string }>();
  const { setTable, setSession, setRestaurant, tableNumber, tableId } = useCart();
  const { loadCurrency } = useCurrency();
  const { loadTheme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; logo: string | null; waitTimeMin: number | null } | null>(null);

  function loadMenu() {
    if (!tableIdParam) return;
    setError(false);
    setLoading(true);
    tableService.getTable(tableIdParam).then((table) => {
      setTable(table.id, table.number);
      setRestaurant(table.restaurantId);
      loadCurrency(table.restaurantId);
      loadTheme(table.restaurantId);
      restaurantService.getRestaurantInfo(table.restaurantId).then(setRestaurantInfo).catch(() => {});
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

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

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
        <p className="text-gray-500 font-medium">Could not load the menu</p>
        <p className="text-sm text-gray-400">Check your connection and try again</p>
        <button
          onClick={loadMenu}
          className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <RefreshCw size={15} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {restaurantInfo?.logo
                ? <img src={restaurantInfo.logo} alt="logo" className="w-8 h-8 object-contain rounded-md" />
                : <UtensilsCrossed size={20} className="text-orange-500" />}
              <h1 className="text-xl font-bold text-gray-900">{restaurantInfo?.name ?? 'Menu'}</h1>
            </div>
            {tableId && (
              <Link
                to={`/order-history/${tableId}`}
                className="flex items-center gap-1.5 text-xs text-orange-500 font-medium bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
              >
                <ClipboardList size={13} />
                My Orders
              </Link>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-500">Table {tableNumber}</p>
            {restaurantInfo?.waitTimeMin && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock size={11} /> ~{restaurantInfo.waitTimeMin} min wait
              </span>
            )}
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3">
          <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">No items in this category</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <CartButton />
    </div>
  );
}

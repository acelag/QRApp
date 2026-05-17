import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Category, MenuItem } from '../../types';
import { menuService } from '../../services/menuService';
import { tableService } from '../../services/tableService';
import { CategoryTabs } from '../../components/CategoryTabs';
import { MenuCard } from '../../components/MenuCard';
import { CartButton } from '../../components/CartButton';
import { useCart } from '../../context/CartContext';
import { sessionService } from '../../services/sessionService';
import { useCurrency } from '../../context/CurrencyContext';
import { UtensilsCrossed, ClipboardList } from 'lucide-react';

export function MenuPage() {
  const { tableId: tableIdParam } = useParams<{ tableId: string }>();
  const { setTable, setSession, setRestaurant, tableNumber, tableId } = useCart();
  const { loadCurrency } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableIdParam) return;
    tableService.getTable(tableIdParam).then((table) => {
      setTable(table.id, table.number);
      setRestaurant(table.restaurantId);
      loadCurrency(table.restaurantId);
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
    });
  }, [tableIdParam]);

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={20} className="text-orange-500" />
              <h1 className="text-xl font-bold text-gray-900">Menu</h1>
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
          <p className="text-sm text-gray-500">Table {tableNumber}</p>
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

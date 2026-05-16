import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export function CartButton() {
  const { itemCount, total } = useCart();
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
      <button
        onClick={() => navigate('/cart')}
        className="w-full max-w-sm bg-orange-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg hover:bg-orange-600 transition-colors"
      >
        <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
          {itemCount}
        </span>
        <span className="font-semibold flex items-center gap-2">
          <ShoppingCart size={18} />
          View Cart
        </span>
        <span className="font-bold">${total.toFixed(2)}</span>
      </button>
    </div>
  );
}

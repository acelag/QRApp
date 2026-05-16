import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { QuantitySelector } from '../../components/QuantitySelector';
import { orderService } from '../../services/orderService';
import toast from 'react-hot-toast';

export function CartPage() {
  const navigate = useNavigate();
  const { items, tableId, tableNumber, sessionId, restaurantId, total, updateQty, removeItem, updateNotes, clearCart } = useCart();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  async function handlePlaceOrder() {
    if (!tableId || !tableNumber || items.length === 0) return;
    setPlacing(true);
    try {
      const order = await orderService.placeOrder(tableId, tableNumber, items, sessionId ?? undefined, restaurantId ?? undefined);
      clearCart();
      navigate(`/order-success/${order.id}`);
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-lg">Your cart is empty</p>
        <button onClick={() => navigate(-1)} className="text-orange-500 font-medium flex items-center gap-1">
          <ArrowLeft size={16} /> Back to Menu
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
            <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
            <p className="text-sm text-gray-500">Table {tableNumber}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {items.map((item) => (
          <div key={item.menuItemId} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-orange-600 font-medium text-sm">${item.price.toFixed(2)} each</p>
              </div>
              <button onClick={() => removeItem(item.menuItemId)} className="text-red-400 hover:text-red-500 ml-2">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <QuantitySelector
                value={item.quantity}
                onChange={(q) => updateQty(item.menuItemId, q)}
                min={0}
              />
              <span className="font-bold text-gray-800">${(item.price * item.quantity).toFixed(2)}</span>
            </div>

            <div className="mt-3">
              {editingNotes === item.menuItemId ? (
                <input
                  autoFocus
                  type="text"
                  value={item.notes ?? ''}
                  onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
                  onBlur={() => setEditingNotes(null)}
                  placeholder="e.g. less spicy, no onion"
                  className="w-full text-sm border border-orange-200 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                />
              ) : (
                <button
                  onClick={() => setEditingNotes(item.menuItemId)}
                  className="text-xs text-orange-500 hover:underline"
                >
                  {item.notes ? `Note: ${item.notes}` : '+ Add note'}
                </button>
              )}
            </div>
          </div>
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-semibold text-base hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {placing ? 'Placing Order…' : `Place Order • $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

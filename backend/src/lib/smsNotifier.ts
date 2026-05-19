export interface OrderConfirmationData {
  orderNumber: string;
  restaurantName: string;
  items: { name: string; quantity: number; price: number; toppingsTotal?: number }[];
  totalAmount: number;
  orderId: string;
  currency?: string;
}

// WhatsApp confirmation is handled client-side via wa.me links.
// This stub keeps existing imports working.
export async function sendOrderConfirmation(
  _phone: string,
  _data: OrderConfirmationData,
): Promise<void> {}

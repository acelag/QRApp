export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  discountPct: number;
  category: string;
  image?: string;
  available: boolean;
}

/** Returns the price after discount (same as price when discountPct is 0). */
export function effectivePrice(item: MenuItem): number {
  return item.discountPct > 0
    ? Math.round(item.price * (1 - item.discountPct / 100) * 100) / 100
    : item.price;
}

export interface Category {
  id: string;
  name: string;
}

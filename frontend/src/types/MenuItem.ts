export interface Topping {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  discountPct: number;
  largePrice?: number;
  largeDiscountPct?: number;
  category: string;
  image?: string;
  available: boolean;
  trackStock?: boolean;
  stock?: number | null;
  toppings?: Topping[];
}

/** Returns the effective price after discount for the given size. */
export function effectivePrice(item: MenuItem, size?: 'regular' | 'large'): number {
  if (size === 'large' && item.largePrice != null) {
    const disc = item.largeDiscountPct ?? 0;
    return disc > 0
      ? Math.round(item.largePrice * (1 - disc / 100) * 100) / 100
      : item.largePrice;
  }
  return item.discountPct > 0
    ? Math.round(item.price * (1 - item.discountPct / 100) * 100) / 100
    : item.price;
}

export interface Category {
  id: string;
  name: string;
}

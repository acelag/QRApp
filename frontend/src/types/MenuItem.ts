export const ITEM_TAGS = [
  { id: 'spicy',       label: 'Spicy',       emoji: '🌶' },
  { id: 'vegan',       label: 'Vegan',       emoji: '🌱' },
  { id: 'popular',     label: 'Popular',     emoji: '⭐' },
  { id: 'new',         label: 'New',         emoji: '🆕' },
  { id: 'vegetarian',  label: 'Vegetarian',  emoji: '🥦' },
  { id: 'gluten-free', label: 'Gluten-Free', emoji: '🌾' },
  { id: 'halal',       label: 'Halal',       emoji: '✅' },
] as const;

export type ItemTagId = (typeof ITEM_TAGS)[number]['id'];

export interface Topping {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
  sortOrder: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  sortOrder: number;
  options: ModifierOption[];
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
  sortOrder?: number;
  tags?: string[];
  toppings?: Topping[];
  modifierGroups?: ModifierGroup[];
  prepTimeMins?: number | null;
  scheduleId?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  spiceLevel?: number | null;
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
  scheduleId?: string | null;
}

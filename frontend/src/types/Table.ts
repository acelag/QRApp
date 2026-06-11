export interface Table {
  id: string;
  restaurantId: string;
  number: number;
  seats: number;
  active: boolean;
  qrCode?: string;
  floorX?: number | null;
  floorY?: number | null;
  floorShape?: 'rect' | 'round';
}

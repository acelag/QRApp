import axios from 'axios';
import type { Room } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export const roomService = {
  getRooms: () => axios.get<Room[]>(`${BASE}/rooms`).then((r) => r.data),
  getRoom:  (id: string) => axios.get<Room>(`${BASE}/rooms/${id}`).then((r) => r.data),
  createRoom: (number: number, name?: string) =>
    axios.post<Room>(`${BASE}/rooms`, { number, name }).then((r) => r.data),
  deleteRoom: (id: string) => axios.delete(`${BASE}/rooms/${id}`),
};

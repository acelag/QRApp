import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/waiters`;

export interface Waiter { id: string; name: string; }

export const waiterService = {
  getWaiters:   ()                  => axios.get<Waiter[]>(BASE).then((r) => r.data),
  addWaiter:    (name: string)      => axios.post<Waiter>(BASE, { name }).then((r) => r.data),
  deleteWaiter: (id: string)        => axios.delete(`${BASE}/${id}`),
};

const KEY = 'qra_offline_queue';

export interface QueuedRequest {
  id: string;
  method: 'POST' | 'PATCH';
  url: string;
  body: unknown;
  label: string;
  queuedAt: string;
}

function notify() {
  window.dispatchEvent(new Event('qra:queue-changed'));
}

export const offlineQueue = {
  getAll(): QueuedRequest[] {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
    catch { return []; }
  },

  push(req: Omit<QueuedRequest, 'id' | 'queuedAt'>): QueuedRequest {
    const entry: QueuedRequest = {
      ...req,
      id: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify([...this.getAll(), entry]));
    notify();
    return entry;
  },

  remove(id: string): void {
    localStorage.setItem(KEY, JSON.stringify(this.getAll().filter((q) => q.id !== id)));
    notify();
  },

  count(): number {
    return this.getAll().length;
  },
};

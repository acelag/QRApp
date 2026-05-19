import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/customer-push`;

/** Returns the VAPID public key from the existing push endpoint */
async function getVapidKey(): Promise<string> {
  const res = await axios.get<{ publicKey: string }>(`${import.meta.env.VITE_API_URL ?? ''}/api/push/vapid-public-key`);
  return res.data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const STORAGE_KEY = (orderId: string) => `cust_push_${orderId}`;

export const customerPushService = {
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  isSubscribed(orderId: string): boolean {
    return localStorage.getItem(STORAGE_KEY(orderId)) === '1';
  },

  async subscribe(orderId: string): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = await getVapidKey();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });
    const json = subscription.toJSON();
    await axios.post(`${BASE}/subscribe`, {
      orderId,
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
    localStorage.setItem(STORAGE_KEY(orderId), '1');
  },

  async unsubscribe(orderId: string): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await axios.delete(`${BASE}/subscribe`, { data: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    }
    localStorage.removeItem(STORAGE_KEY(orderId));
  },
};

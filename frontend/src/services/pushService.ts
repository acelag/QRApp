import axios from 'axios';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export const pushService = {
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  permissionState(): NotificationPermission {
    return Notification.permission;
  },

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  },

  async subscribe(): Promise<PushSubscription> {
    // 1. Use the SW already registered by the PWA (vite-plugin-pwa registers /sw.js on load)
    const reg = await navigator.serviceWorker.ready;

    // 2. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission denied');

    // 3. Fetch VAPID public key from backend
    const { data } = await axios.get<{ publicKey: string }>('/api/push/vapid-public-key');
    const appServerKey = urlBase64ToUint8Array(data.publicKey);

    // 4. Create push subscription
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });

    // 5. Send subscription to backend
    await axios.post('/api/push/subscribe', subscription.toJSON());

    return subscription;
  },

  async unsubscribe(): Promise<void> {
    const subscription = await this.getSubscription();
    if (!subscription) return;

    // Tell backend to remove it
    await axios.delete('/api/push/subscribe', {
      data: { endpoint: subscription.endpoint },
    });

    await subscription.unsubscribe();
  },
};

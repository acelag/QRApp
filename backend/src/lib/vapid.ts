import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

const KEYS_FILE = path.join(__dirname, '../../vapid.json');

function loadOrCreate(): { publicKey: string; privateKey: string } {
  // 1. Environment variables (production)
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey:  process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  // 2. Persisted file (development — survives restarts)
  if (fs.existsSync(KEYS_FILE)) {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')) as { publicKey: string; privateKey: string };
  }

  // 3. Generate fresh keys, save for next time
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  console.log('✓ VAPID keys generated → vapid.json');
  return keys;
}

const keys = loadOrCreate();

webpush.setVapidDetails(
  'mailto:admin@restaurant.local',
  keys.publicKey,
  keys.privateKey,
);

export const vapidPublicKey = keys.publicKey;

/**
 * Push Notification Service (Frontend)
 *
 * Handles the full browser-side lifecycle:
 *   1. registerServiceWorker  — registers /sw.js (idempotent)
 *   2. getVapidPublicKey      — fetches the public key from the backend
 *   3. subscribeToPush        — calls PushManager.subscribe() + saves to DB
 *   4. unsubscribeFromPush    — calls subscription.unsubscribe() + removes from DB
 *   5. getCurrentSubscription — checks if a push subscription already exists
 *
 * All functions are safe to call multiple times — they check state before acting.
 */

import { api } from './api';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a URL-safe base64 string to a Uint8Array (required by PushManager) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ── Service Worker Registration ───────────────────────────────────────────────

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('[push] Service workers not supported in this browser.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[push] Service worker registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[push] Service worker registration failed:', err);
    return null;
  }
};

// ── Fetch VAPID Public Key ────────────────────────────────────────────────────

const getVapidPublicKey = async (): Promise<string> => {
  // The api interceptor unwraps response.data, so `res` = { success, data: { publicKey } }
  const res = await api.get<{ success: boolean; data: { publicKey: string } }>(
    '/push/vapid-public-key'
  ) as unknown as { success: boolean; data: { publicKey: string } };
  return res.data.publicKey;
};

// ── Get Current Subscription ──────────────────────────────────────────────────

export const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

// ── Subscribe ─────────────────────────────────────────────────────────────────

export const subscribeToPush = async (): Promise<PushSubscription | null> => {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;

    const vapidKey         = await getVapidPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);

    // Ask the browser's push manager for a subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required — push must result in a visible notification
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    // Persist to backend so the server can send pushes to this device
    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth:   btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      },
    });

    console.log('[push] Subscribed and saved to server.');
    return subscription;
  } catch (err) {
    console.error('[push] subscribeToPush failed:', err);
    return null;
  }
};

// ── Unsubscribe ───────────────────────────────────────────────────────────────

export const unsubscribeFromPush = async (): Promise<boolean> => {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) return true; // already unsubscribed

    // Remove from backend first so no pushes fire between now and browser unsubscribe
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });

    // Then revoke the browser subscription
    await subscription.unsubscribe();

    console.log('[push] Unsubscribed.');
    return true;
  } catch (err) {
    console.error('[push] unsubscribeFromPush failed:', err);
    return false;
  }
};

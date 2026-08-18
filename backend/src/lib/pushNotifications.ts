/**
 * Web Push Delivery Library
 *
 * THIS IS THE ONLY FILE IN THE CODEBASE THAT KNOWS ABOUT web-push.
 *
 * sendWebPush(subscription, payload):
 *   - Sends a push notification to a single browser subscription.
 *   - If the push service returns 404 or 410 (subscription no longer valid),
 *     the subscription row is deleted from the DB so it is never retried.
 *   - Other errors are logged but do NOT throw — a failed push to one device
 *     must not abort delivery to other devices.
 *
 * webPushDeliver(userId, payload):
 *   - Fetches all subscriptions for the given userId and calls sendWebPush
 *     on each one. This is the concrete DeliverFn passed to notifyDueReminders().
 *   - Swappable: for Electron pass an Electron IPC deliver fn; for FCM pass an
 *     FCM deliver fn. The detection logic (reminderNotifier.ts) never changes.
 */

import webPush from 'web-push';
import { env } from '../config/env';
import { getSubscriptionsForUser, removeSubscription } from '../modules/push/push.service';

// Configure VAPID credentials once at module load
webPush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export interface NotificationPayload {
  title: string;
  body:  string;
}

interface RawSubscription {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

// ── Single-subscription send ──────────────────────────────────────────────────

export const sendWebPush = async (
  sub: RawSubscription,
  payload: NotificationPayload
): Promise<void> => {
  try {
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 86400 } // 24-hour TTL — push server holds it up to a day if device is offline
    );
  } catch (err: any) {
    // ── Dead subscription cleanup ─────────────────────────────────────────────
    // statusCode 404 = endpoint gone; 410 = explicitly unsubscribed by browser.
    // In both cases the subscription is permanently invalid — delete it so the
    // 60s polling cycle never attempts delivery to this endpoint again.
    const statusCode = err?.statusCode as number | undefined;
    if (statusCode === 404 || statusCode === 410) {
      console.warn(
        `[push] Subscription expired (HTTP ${statusCode}), removing: ${sub.endpoint.slice(0, 60)}...`
      );
      await removeSubscription(sub.endpoint); // ← line 63: dead subscription delete
      return;
    }
    // Non-fatal for other devices — log but continue
    console.error('[push] sendWebPush failed:', err?.message ?? err);
  }
};

// ── Multi-subscription deliver (the concrete DeliverFn) ──────────────────────

export const webPushDeliver = async (
  userId: string,
  payload: NotificationPayload
): Promise<void> => {
  const subscriptions = await getSubscriptionsForUser(userId);
  if (subscriptions.length === 0) return;

  await Promise.all(subscriptions.map((sub) => sendWebPush(sub, payload)));
};

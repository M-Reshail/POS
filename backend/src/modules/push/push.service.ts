/**
 * Push Subscription Service
 *
 * Manages browser Web Push subscriptions stored in the DB.
 * One User → many PushSubscription rows (one per device/browser).
 *
 * saveSubscription   — upsert by endpoint (re-subscribing same browser updates keys)
 * removeSubscription — delete by endpoint (unsubscribe or dead-subscription cleanup)
 * getSubscriptionsForUser — fetch all active subscriptions for a user
 */

import { prisma } from '../../lib/prisma';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

// ── Save (upsert by endpoint) ─────────────────────────────────────────────────

export const saveSubscription = async (
  userId: string,
  sub: PushSubscriptionInput
) => {
  return prisma.pushSubscription.upsert({
    where:  { endpoint: sub.endpoint },
    update: { p256dh: sub.p256dh, auth: sub.auth, userId },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
  });
};

// ── Remove (by endpoint) ──────────────────────────────────────────────────────

export const removeSubscription = async (endpoint: string) => {
  // deleteMany avoids a "record not found" error if already gone
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
};

// ── Get all subscriptions for a user ─────────────────────────────────────────

export const getSubscriptionsForUser = async (userId: string) => {
  return prisma.pushSubscription.findMany({ where: { userId } });
};

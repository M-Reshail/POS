/**
 * Push Subscription Controller
 *
 * GET  /api/push/vapid-public-key  — return VAPID public key (no auth needed;
 *                                    public key is safe to expose)
 * POST /api/push/subscribe         — save a subscription for req.user.id
 * POST /api/push/unsubscribe       — remove a subscription by endpoint
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import * as pushService from './push.service';
import { ok, badRequest, handleServiceError } from '../../lib/response';

// ── Validation ────────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL.'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL.'),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/push/vapid-public-key — frontend needs this to call PushManager.subscribe() */
export const getVapidPublicKey = (_req: Request, res: Response): void => {
  ok(res, { publicKey: env.VAPID_PUBLIC_KEY });
};

/** POST /api/push/subscribe — save subscription for authenticated user */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid subscription payload.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const subscription = await pushService.saveSubscription(req.user!.id, {
      endpoint: parsed.data.endpoint,
      p256dh:   parsed.data.keys.p256dh,
      auth:     parsed.data.keys.auth,
    });
    ok(res, { subscription });
  } catch (error) {
    handleServiceError(res, error, {});
  }
};

/** POST /api/push/unsubscribe — remove subscription for authenticated user */
export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid unsubscribe payload.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    await pushService.removeSubscription(parsed.data.endpoint);
    ok(res, { unsubscribed: true });
  } catch (error) {
    handleServiceError(res, error, {});
  }
};

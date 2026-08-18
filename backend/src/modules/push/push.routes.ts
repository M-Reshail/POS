/**
 * Push Notification Routes
 *
 * Mounted at /api/push in src/index.ts.
 *
 * GET  /api/push/vapid-public-key  — public key for frontend subscription
 *                                    (no auth — public key is safe to expose)
 * POST /api/push/subscribe         — save a browser subscription (auth required)
 * POST /api/push/unsubscribe       — remove a browser subscription (auth required)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getVapidPublicKey, subscribe, unsubscribe } from './push.controller';

const router = Router();

// Public — the VAPID public key must be fetched before the user has authed
// (or immediately after login) so the SW can subscribe early.
router.get('/vapid-public-key', getVapidPublicKey);

// Auth-required — subscription is tied to req.user.id
router.post('/subscribe',   authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);

export default router;

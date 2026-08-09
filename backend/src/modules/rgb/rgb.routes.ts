/**
 * RGB Items Routes
 *
 * GET    /api/rgb                        → Both: list all RGB items + stock counts
 * POST   /api/rgb                        → Admin: create new RGB item
 * GET    /api/rgb/retailer/:retailerId   → Both: retailer's per-item crate balances
 * POST   /api/rgb/:id/return            → Both: standalone crate return from retailer
 * PUT    /api/rgb/:id                    → Admin: edit name or set stockQuantity directly
 * DELETE /api/rgb/:id                    → Admin: remove RGB item (blocked if balances > 0)
 *
 * IMPORTANT: /retailer/:retailerId must be declared BEFORE /:id to prevent Express
 * from matching the literal string "retailer" as an :id param.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  listRGBItems,
  createRGBItem,
  updateRGBItem,
  deleteRGBItem,
  getRetailerBalances,
  returnRGBStandalone,
} from './rgb.controller';

const router = Router();

router.use(authenticate);

// Both roles — read-only and workflow endpoints
router.get('/', listRGBItems);
router.get('/retailer/:retailerId', getRetailerBalances);   // must be before /:id
router.post('/:id/return', returnRGBStandalone);            // both roles can record returns

// Admin-only write operations
router.post('/',      requireRole('admin'), createRGBItem);
router.put('/:id',    requireRole('admin'), updateRGBItem);
router.delete('/:id', requireRole('admin'), deleteRGBItem);

export default router;

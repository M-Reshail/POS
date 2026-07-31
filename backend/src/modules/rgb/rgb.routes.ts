/**
 * RGB Items Routes
 *
 * GET    /api/rgb        → Both: list all RGB items + stock counts
 * POST   /api/rgb        → Admin: create new RGB item
 * PUT    /api/rgb/:id    → Admin: edit name or set stockQuantity directly
 * DELETE /api/rgb/:id    → Admin: remove RGB item (blocked if balances > 0)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  listRGBItems,
  createRGBItem,
  updateRGBItem,
  deleteRGBItem,
} from './rgb.controller';

const router = Router();

router.use(authenticate);

// Both roles can view RGB stock (needed for sales-flow reference in Prompt 10)
router.get('/', listRGBItems);

// Admin-only write operations
router.post('/',     requireRole('admin'), createRGBItem);
router.put('/:id',   requireRole('admin'), updateRGBItem);
router.delete('/:id', requireRole('admin'), deleteRGBItem);

export default router;

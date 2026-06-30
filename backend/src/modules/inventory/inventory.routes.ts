/**
 * Inventory Routes — Admin only
 *
 * GET    /api/inventory                → All stock batches
 * GET    /api/inventory/low-stock      → Batches below threshold
 * GET    /api/inventory/expiry-risk    → Batches expiring within 30 days
 * GET    /api/inventory/:id            → Single batch detail
 * POST   /api/inventory                → Add new stock batch
 * PUT    /api/inventory/:id            → Update batch
 * POST   /api/inventory/:id/adjust     → Manual stock adjustment (with audit)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  listStockBatches,
  getStockBatch,
  createStockBatch,
  updateStockBatch,
  adjustStock,
  getLowStock,
  getExpiryRisk,
} from './inventory.controller';

const router = Router();

router.use(authenticate);

// ── Both Roles (read-only) ─────────────────────────────────────────────────────
// Workers need stock data to display availability in the sales screen
router.get('/low-stock', getLowStock);
router.get('/expiry-risk', getExpiryRisk);
router.get('/', listStockBatches);
router.get('/:id', getStockBatch);

// ── Admin Only (write operations) ─────────────────────────────────────────────
router.post('/', requireRole('admin'), createStockBatch);
router.put('/:id', requireRole('admin'), updateStockBatch);
router.post('/:id/adjust', requireRole('admin'), adjustStock);

export default router;

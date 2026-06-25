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
router.use(requireRole('admin')); // All inventory routes are admin-only

// Named sub-routes first (before /:id)
router.get('/low-stock', getLowStock);
router.get('/expiry-risk', getExpiryRisk);

router.get('/', listStockBatches);
router.get('/:id', getStockBatch);
router.post('/', createStockBatch);
router.put('/:id', updateStockBatch);
router.post('/:id/adjust', adjustStock);

export default router;

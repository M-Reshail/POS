/**
 * Retailers Routes — Admin only
 *
 * GET    /api/retailers                    → All retailers with credit summary
 * GET    /api/retailers/:id                → Single retailer detail
 * POST   /api/retailers                    → Create retailer
 * PUT    /api/retailers/:id                → Update retailer
 * GET    /api/retailers/:id/ledger         → Retailer ledger (paginated)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  listRetailers,
  getRetailer,
  createRetailer,
  updateRetailer,
  getRetailerLedger,
} from './retailer.controller';

const router = Router();

// All authenticated users can read and create retailers
router.use(authenticate);

router.get('/', listRetailers);
router.get('/:id', getRetailer);
router.post('/', createRetailer);

// Admin-only mutations
router.put('/:id', requireRole('admin'), updateRetailer);
router.get('/:id/ledger', requireRole('admin'), getRetailerLedger);

export default router;


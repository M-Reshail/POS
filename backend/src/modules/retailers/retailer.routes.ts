/**
 * Retailers Routes — Admin only
 *
 * GET    /api/retailers                    → All retailers with credit summary
 * GET    /api/retailers/:id                → Single retailer detail
 * POST   /api/retailers                    → Create retailer
 * PUT    /api/retailers/:id                → Update retailer
 * GET    /api/retailers/:id/ledger         → Retailer ledger (paginated)
 * GET    /api/retailers/:id/rgb            → RGB crate tracking
 * PUT    /api/retailers/:id/rgb            → Update RGB crate balance
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
  getRetailerRGB,
  updateRetailerRGB,
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
router.get('/:id/rgb', requireRole('admin'), getRetailerRGB);
router.put('/:id/rgb', requireRole('admin'), updateRetailerRGB);

export default router;

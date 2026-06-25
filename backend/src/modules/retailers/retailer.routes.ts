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

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', listRetailers);
router.post('/', createRetailer);
router.get('/:id', getRetailer);
router.put('/:id', updateRetailer);
router.get('/:id/ledger', getRetailerLedger);
router.get('/:id/rgb', getRetailerRGB);
router.put('/:id/rgb', updateRetailerRGB);

export default router;

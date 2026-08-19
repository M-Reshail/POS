/**
 * Bills Routes
 *
 * POST   /api/bills                          → Create bill (Worker or Admin)
 * POST   /api/bills/preview-udhaar-allocation → Allocation preview, no DB writes (both roles)
 * GET    /api/bills                          → List bills (Admin: all | Worker: own only)
 * GET    /api/bills/:id                      → Bill detail (Admin: any | Worker: own only)
 * POST   /api/bills/:id/payment              → Add payment (Admin only)
 * POST   /api/bills/:id/void                 → Void/cancel bill (Admin only)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  createBill,
  listBills,
  getBill,
  addPayment,
  voidBill,
  previewUdhaarAllocation,
} from './bill.controller';

const router = Router();

router.use(authenticate);

// Both roles (RBAC applied inside controller)
router.post('/', createBill);
// NOTE: /preview-udhaar-allocation MUST be registered before /:id to avoid
// Express treating 'preview-udhaar-allocation' as a bill ID parameter.
router.post('/preview-udhaar-allocation', previewUdhaarAllocation);
router.get('/', listBills);
router.get('/:id', getBill);

// Admin only
router.post('/:id/payment', requireRole('admin'), addPayment);
router.post('/:id/void', requireRole('admin'), voidBill);

export default router;

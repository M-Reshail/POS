/**
 * Ledger Routes — Admin only
 *
 * GET    /api/ledger                    → Credit summary across all retailers
 * GET    /api/ledger/retailer/:id       → Full ledger entries for one retailer
 * POST   /api/ledger/payment            → Record a direct payment
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { getLedgerSummary, getRetailerLedger, recordPayment } from './ledger.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', getLedgerSummary);
router.get('/retailer/:id', getRetailerLedger);
router.post('/payment', recordPayment);

export default router;

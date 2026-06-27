/**
 * Workers Routes — Admin only
 *
 * GET    /api/workers              → List all workers
 * GET    /api/workers/:id          → Worker profile + sales
 * POST   /api/workers              → Create worker
 * PATCH  /api/workers/:id          → Update worker profile/status
 * POST   /api/workers/:id/reset-password → Admin resets password
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { listWorkers, getWorker, createWorker, updateWorker, resetWorkerPassword } from './worker.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', listWorkers);
router.get('/:id', getWorker);
router.post('/', createWorker);
router.patch('/:id', updateWorker);
router.post('/:id/reset-password', resetWorkerPassword);

export default router;

/**
 * Brand Routes
 *
 * GET  /api/brands        — list all brands (admin)
 * GET  /api/brands/:id    — single brand
 * POST /api/brands        — create brand + upload image (admin)
 * PUT  /api/brands/:id    — update brand name/image (admin)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as brandController from './brand.controller';

const router = Router();

router.get('/',     authenticate, brandController.listBrands);
router.get('/:id',  authenticate, brandController.getBrand);
router.post('/',    authenticate, requireRole('admin'), brandController.createBrand);
router.put('/:id',  authenticate, requireRole('admin'), brandController.updateBrand);

export default router;

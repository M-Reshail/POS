/**
 * Products Routes
 *
 * GET    /api/products            → Admin: all products with stock summary
 * GET    /api/products/in-stock   → Both: products that have available stock (worker sales screen)
 * GET    /api/products/:id        → Both: single product detail
 * POST   /api/products            → Admin: create product
 * PUT    /api/products/:id        → Admin: update product
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  listProducts,
  listProductsInStock,
  getProduct,
  createProduct,
  updateProduct,
} from './product.controller';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// ── Both Roles ────────────────────────────────────────────────────────────────
router.get('/in-stock', listProductsInStock);        // Must be before /:id
router.get('/:id', getProduct);

// ── Admin Only ────────────────────────────────────────────────────────────────
router.get('/', requireRole('admin'), listProducts);
router.post('/', requireRole('admin'), createProduct);
router.put('/:id', requireRole('admin'), updateProduct);

export default router;

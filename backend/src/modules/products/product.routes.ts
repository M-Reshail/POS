/**
 * Products Routes
 *
 * GET    /api/products          → Both: all active products with brand + stock summary
 * GET    /api/products/in-stock → Both: active products with available stock (worker screen)
 * GET    /api/products/:id      → Both: single product detail
 * POST   /api/products          → Admin: create product (JSON body, brandId required)
 * PUT    /api/products/:id      → Admin: update product (JSON body, variant/category/description only)
 * DELETE /api/products/:id      → Admin: soft-delete product (sets isActive=false)
 *
 * Note: Image upload moved to /api/brands/:id (brand-level images)
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
  deleteProduct,
} from './product.controller';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// ── Both Roles (read-only) ────────────────────────────────────────────────────
router.get('/',          listProducts);
router.get('/in-stock',  listProductsInStock); // Must be before /:id
router.get('/:id',       getProduct);

// ── Admin Only (write operations) ─────────────────────────────────────────────
router.post('/',         requireRole('admin'), createProduct);
router.put('/:id',       requireRole('admin'), updateProduct);
router.delete('/:id',    requireRole('admin'), deleteProduct);

export default router;

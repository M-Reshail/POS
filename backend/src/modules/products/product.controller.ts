/**
 * Products Controller
 *
 * Admin: full CRUD on product catalog
 * Worker: read-only access to in-stock products (sales screen)
 *
 * Create product flow:
 *   Option A (existing brand): send brandId in JSON body — no image needed
 *   Option B (new brand inline): use POST /api/brands first, then POST /api/products with brandId
 *
 * Image upload is now handled at Brand level (PUT /api/brands/:id).
 * Product.imageUrl column is kept but not written going forward.
 *
 * Bug 2 fix: updateProduct validates only variant/category/description.
 * Brand is excluded entirely from the update schema.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as productService from './product.service';
import {
  ok, created, badRequest, conflict, handleServiceError,
} from '../../lib/response';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createProductSchema = z.object({
  brandId:     z.string().uuid('Invalid brandId — must be a valid brand UUID.'),
  category:    z.string().min(1, 'Category is required.').trim(),
  variant:     z.string().min(1, 'Variant is required.').trim(),
  description: z.string().trim().optional(),
});

// Update: only variant, category, description — NOT brandId, NOT brand string
const updateProductSchema = z.object({
  variant:     z.string().min(1).trim().optional(),
  category:    z.string().min(1).trim().optional(),
  description: z.string().trim().optional(),
});

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  PRODUCT_NOT_FOUND: { status: 404, message: 'Product not found.' },
  BRAND_NOT_FOUND:   { status: 404, message: 'Brand not found. Create the brand first.' },
};

const parsePrefixedError = (error: unknown, res: Response): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message;

  if (msg.startsWith('DUPLICATE_PRODUCT:')) {
    conflict(res, msg.slice('DUPLICATE_PRODUCT:'.length));
    return true;
  }

  if (msg.startsWith('PRODUCT_HAS_STOCK:')) {
    const units = msg.slice('PRODUCT_HAS_STOCK:'.length);
    res.status(409).json({
      success: false,
      message: `Cannot delete: this product still has ${units} units in stock. ` +
               `Reduce the stock to 0 first before deleting.`,
    });
    return true;
  }

  return false;
};

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/products — Active products with brand and stock summary (Admin) */
export const listProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await productService.getAllProducts();
    ok(res, { products });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/products/in-stock — Active products with available stock (Worker sales) */
export const listProductsInStock = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await productService.getProductsInStock();
    ok(res, { products });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/products/:id — Single product detail */
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await productService.getProductById(req.params.id);
    ok(res, { product });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/**
 * POST /api/products — Create product (Admin, JSON body)
 * Required: { brandId, variant, category, description? }
 * Brand must already exist. Image is managed at Brand level.
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }

  try {
    const product = await productService.createProduct(parsed.data);
    created(res, { product });
  } catch (error) {
    if (parsePrefixedError(error, res)) return;
    handleServiceError(res, error, ERROR_MAP);
  }
};

/**
 * PUT /api/products/:id — Update product (Admin, JSON body)
 * Allowed fields: variant, category, description
 * Brand is intentionally excluded — change brand image via PUT /api/brands/:id
 */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }

  try {
    const product = await productService.updateProduct(req.params.id, parsed.data);
    ok(res, { product });
  } catch (error) {
    if (parsePrefixedError(error, res)) return;
    handleServiceError(res, error, ERROR_MAP);
  }
};

/**
 * DELETE /api/products/:id — Soft-delete (Admin)
 * Sets isActive=false. Blocked if any stock batches have quantity > 0.
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await productService.softDeleteProduct(req.params.id);
    ok(res, { product, message: 'Product hidden from inventory and sales.' });
  } catch (error) {
    if (parsePrefixedError(error, res)) return;
    handleServiceError(res, error, ERROR_MAP);
  }
};

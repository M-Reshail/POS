/**
 * Products Controller
 *
 * Admin: full CRUD on product catalog
 * Worker: read-only access to products that have stock (for sales screen)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as productService from './product.service';
import {
  ok, created, notFound, badRequest, conflict, handleServiceError,
} from '../../lib/response';

// ── Validation Schemas ────────────────────────────────────────────────────────

const categoryValues = ['soft_drink', 'juice', 'water', 'energy_drink'] as const;

const createProductSchema = z.object({
  brand: z.string().min(1, 'Brand is required.').trim(),
  category: z.enum(categoryValues, { errorMap: () => ({ message: 'Invalid category.' }) }),
  variant: z.string().min(1, 'Variant is required.').trim(),
  petConversionFactor: z
    .number({ invalid_type_error: 'PET conversion factor must be a number.' })
    .int('PET conversion factor must be an integer.')
    .min(1, 'PET conversion factor must be at least 1.'),
  description: z.string().trim().optional(),
});

const updateProductSchema = createProductSchema.partial();

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  PRODUCT_NOT_FOUND: { status: 404, message: 'Product not found.' },
  PRODUCT_ALREADY_EXISTS: { status: 409, message: 'A product with this brand and variant already exists.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/products — All products with stock summary (Admin) */
export const listProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await productService.getAllProducts();
    ok(res, { products });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/products/in-stock — Products with available stock (Worker sales screen) */
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

/** POST /api/products — Create product (Admin) */
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
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** PUT /api/products/:id — Update product (Admin) */
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
    handleServiceError(res, error, ERROR_MAP);
  }
};

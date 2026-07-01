/**
 * Inventory Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as inventoryService from './inventory.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';
import { AdjustmentReason } from '@prisma/client';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createBatchSchema = z.object({
  productId: z.string().uuid('Invalid product ID.'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1.'),
  buyPrice: z.number().positive('Buy price must be positive.'),
  salePrice: z.number().positive('Sale price must be positive.'),
  batchNumber: z.string().min(1).trim(),
  expiryDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid expiry date.' }),
  purchaseDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid purchase date.' }).optional(),
  supplierId: z.string().optional(),
  supplier: z.string().trim().optional(),
});

const updateBatchSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  buyPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  expiryDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  purchaseDate: z.string().refine((d) => !isNaN(Date.parse(d))).optional(),
  supplierId: z.string().optional(),
  supplier: z.string().trim().optional(),
});

const adjustStockSchema = z.object({
  quantity: z.number().int().refine((n) => n !== 0, { message: 'Quantity cannot be zero.' }),
  reason: z.nativeEnum(AdjustmentReason),
  notes: z.string().min(3, 'Notes must be at least 3 characters.').trim(),
});

const ERROR_MAP = {
  STOCK_BATCH_NOT_FOUND: { status: 404, message: 'Stock batch not found.' },
  PRODUCT_NOT_FOUND: { status: 404, message: 'Product not found.' },
  BATCH_NUMBER_EXISTS: { status: 409, message: 'A batch with this batch number already exists.' },
  INSUFFICIENT_STOCK: { status: 422, message: 'Insufficient stock for this adjustment.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

export const listStockBatches = async (_req: Request, res: Response): Promise<void> => {
  try {
    const batches = await inventoryService.getAllStockBatches();
    ok(res, { batches });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getStockBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const batch = await inventoryService.getStockBatchById(req.params.id);
    ok(res, { batch });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const createStockBatch = async (req: Request, res: Response): Promise<void> => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const batch = await inventoryService.createStockBatch(parsed.data);
    created(res, { batch });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const updateStockBatch = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const batch = await inventoryService.updateStockBatch(req.params.id, parsed.data);
    ok(res, { batch });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  const parsed = adjustStockSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const result = await inventoryService.adjustStock(req.params.id, {
      ...parsed.data,
      adminId: req.user!.id,
    });
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getLowStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
    const batches = await inventoryService.getLowStockBatches(threshold);
    ok(res, { batches, threshold });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getExpiryRisk = async (_req: Request, res: Response): Promise<void> => {
  try {
    const batches = await inventoryService.getExpiryRiskBatches();
    ok(res, { batches });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

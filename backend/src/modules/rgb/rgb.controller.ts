/**
 * RGB Items Controller
 *
 * REST handlers for the flat RGB crate stock CRUD system.
 *
 * GET    /api/rgb        — list all RGBItems
 * POST   /api/rgb        — create a new RGBItem (name + startingQuantity)
 * PUT    /api/rgb/:id    — update name and/or set stockQuantity directly
 * DELETE /api/rgb/:id    — remove (blocked if any retailer balance > 0)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as rgbService from './rgb.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createRGBItemSchema = z.object({
  name:          z.string().min(1, 'Name is required.').trim(),
  stockQuantity: z.number().int().min(0, 'Starting quantity cannot be negative.').optional().default(0),
});

const updateRGBItemSchema = z.object({
  name:          z.string().min(1, 'Name cannot be empty.').trim().optional(),
  stockQuantity: z.number().int().min(0, 'Stock quantity cannot be negative.').optional(),
}).refine(data => data.name !== undefined || data.stockQuantity !== undefined, {
  message: 'Provide at least one field to update (name or stockQuantity).',
});

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  RGB_ITEM_NOT_FOUND:              { status: 404, message: 'RGB item not found.' },
  RGB_ITEM_ALREADY_EXISTS:         { status: 409, message: 'An RGB item with this name already exists.' },
  RGB_ITEM_HAS_OUTSTANDING_BALANCES: {
    status: 409,
    message: 'Cannot delete: one or more retailers still owe crates for this item. Resolve outstanding balances first.',
  },
};

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/rgb — List all RGB items */
export const listRGBItems = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await rgbService.getAllRGBItems();
    ok(res, { items });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** POST /api/rgb — Create a new RGB item */
export const createRGBItem = async (req: Request, res: Response): Promise<void> => {
  const parsed = createRGBItemSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const item = await rgbService.createRGBItem(parsed.data);
    created(res, { item });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** PUT /api/rgb/:id — Edit name or set stockQuantity directly */
export const updateRGBItem = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateRGBItemSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const item = await rgbService.updateRGBItem(req.params.id, parsed.data);
    ok(res, { item });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** DELETE /api/rgb/:id — Remove an RGB item */
export const deleteRGBItem = async (req: Request, res: Response): Promise<void> => {
  try {
    await rgbService.deleteRGBItem(req.params.id);
    ok(res, { message: 'RGB item deleted.' });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

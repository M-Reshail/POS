/**
 * RGB Items Controller
 *
 * REST handlers for the RGB crate stock system.
 *
 * GET    /api/rgb                         — list all RGBItems
 * POST   /api/rgb                         — create a new RGBItem (admin)
 * PUT    /api/rgb/:id                     — update name / set stockQuantity directly (admin)
 * DELETE /api/rgb/:id                     — remove (admin; blocked if any retailer balance > 0)
 * GET    /api/rgb/retailer/:retailerId    — retailer's per-item crate balances (both roles)
 * POST   /api/rgb/:id/return             — standalone crate return from a retailer (both roles)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
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

const returnRGBSchema = z.object({
  retailerId: z.string().uuid('Invalid retailer ID.'),
  quantity:   z.number().int().positive('Return quantity must be a positive integer.'),
});

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  RGB_ITEM_NOT_FOUND:              { status: 404, message: 'RGB item not found.' },
  RGB_ITEM_ALREADY_EXISTS:         { status: 409, message: 'An RGB item with this name already exists.' },
  RGB_ITEM_HAS_OUTSTANDING_BALANCES: {
    status: 409,
    message: 'Cannot delete: one or more retailers still owe crates for this item. Resolve outstanding balances first.',
  },
  INSUFFICIENT_RGB_STOCK: {
    status: 422,
    message: 'Insufficient warehouse crate stock for this RGB item.',
  },
  RETAILER_NOT_FOUND: { status: 404, message: 'Retailer not found.' },
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

/**
 * GET /api/rgb/retailer/:retailerId
 * Returns all per-item RGB balances for a specific retailer (with item names).
 * Both roles can call this (workers need it during a sale).
 */
export const getRetailerBalances = async (req: Request, res: Response): Promise<void> => {
  try {
    const balances = await rgbService.getRetailerRGBBalances(req.params.retailerId);
    ok(res, { balances });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/**
 * POST /api/rgb/:id/return
 * Standalone crate return (outside a sale transaction).
 * Body: { retailerId, quantity }
 * Both roles can record a return.
 */
export const returnRGBStandalone = async (req: Request, res: Response): Promise<void> => {
  const parsed = returnRGBSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }

  const { retailerId, quantity } = parsed.data;
  const rgbItemId = req.params.id;
  const workerId = req.user!.id;

  try {
    await prisma.$transaction(async (tx) => {
      // Verify RGB item exists before starting
      const item = await tx.rGBItem.findUnique({ where: { id: rgbItemId } });
      if (!item) throw new Error('RGB_ITEM_NOT_FOUND');

      // Verify retailer exists
      const retailer = await tx.retailer.findUnique({ where: { id: retailerId } });
      if (!retailer) throw new Error('RETAILER_NOT_FOUND');

      await rgbService.returnRGB(tx, { retailerId, rgbItemId, quantity, workerId });
    });

    ok(res, { message: 'Crate return recorded successfully.' });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

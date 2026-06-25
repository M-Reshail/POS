/**
 * Retailers Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as retailerService from './retailer.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';
import { PriceTier } from '@prisma/client';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createRetailerSchema = z.object({
  shopName: z.string().min(1, 'Shop name is required.').trim(),
  ownerName: z.string().min(1, 'Owner name is required.').trim(),
  mobileNumber: z.string().min(7, 'Invalid mobile number.').trim(),
  address: z.string().min(1, 'Address is required.').trim(),
  deliveryLocation: z.string().trim().optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative.'),
  priceTier: z.nativeEnum(PriceTier).default(PriceTier.standard),
});

const updateRetailerSchema = createRetailerSchema.partial();

const rgbUpdateSchema = z.object({
  issuedQuantity: z.number().int().min(0).optional(),
  returnedQuantity: z.number().int().min(0).optional(),
});

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ERROR_MAP = {
  RETAILER_NOT_FOUND: { status: 404, message: 'Retailer not found.' },
  RGB_BALANCE_NEGATIVE: { status: 422, message: 'Returned quantity cannot exceed issued quantity.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

export const listRetailers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const retailers = await retailerService.getAllRetailers();
    ok(res, { retailers });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getRetailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const retailer = await retailerService.getRetailerById(req.params.id);
    ok(res, { retailer });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const createRetailer = async (req: Request, res: Response): Promise<void> => {
  const parsed = createRetailerSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const retailer = await retailerService.createRetailer(parsed.data);
    created(res, { retailer });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const updateRetailer = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateRetailerSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const retailer = await retailerService.updateRetailer(req.params.id, parsed.data);
    ok(res, { retailer });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getRetailerLedger = async (req: Request, res: Response): Promise<void> => {
  const query = ledgerQuerySchema.safeParse(req.query);
  if (!query.success) { badRequest(res, 'Invalid query parameters.'); return; }
  try {
    const ledger = await retailerService.getRetailerLedger(
      req.params.id, query.data.limit, query.data.offset
    );
    ok(res, ledger);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getRetailerRGB = async (req: Request, res: Response): Promise<void> => {
  try {
    const rgb = await retailerService.getRetailerRGB(req.params.id);
    ok(res, { rgb });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const updateRetailerRGB = async (req: Request, res: Response): Promise<void> => {
  const parsed = rgbUpdateSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const rgb = await retailerService.updateRetailerRGB(req.params.id, parsed.data);
    ok(res, { rgb });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

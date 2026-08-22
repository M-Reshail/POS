/**
 * Retailers Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as retailerService from './retailer.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';


// ── Validation Schemas ────────────────────────────────────────────────────────

const createRetailerSchema = z.object({
  shopName: z.string().min(1, 'Shop name is required.').trim(),
  ownerName: z.string().min(1, 'Owner name is required.').trim(),
  mobileNumber: z.string().min(7, 'Invalid mobile number.').trim(),
  address: z.string().min(1, 'Address is required.').trim(),
  deliveryLocation: z.string().trim().optional(),
});

const updateRetailerSchema = createRetailerSchema.partial();

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be positive.'),
});

const ERROR_MAP = {
  RETAILER_NOT_FOUND: { status: 404, message: 'Retailer not found.' },
  INVALID_PAYMENT_AMOUNT: { status: 422, message: 'Payment amount must be greater than zero.' },
  NO_PENDING_BILLS: { status: 409, message: 'This retailer has no pending bills to pay.' },
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
      req.params.id,
      query.data.limit,
      query.data.offset,
      query.data.startDate,
      query.data.endDate
    );
    ok(res, ledger);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** POST /api/retailers/:id/record-payment — Admin records a FIFO payment across all pending bills */
export const recordRetailerPayment = async (req: Request, res: Response): Promise<void> => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const plan = await retailerService.recordRetailerPayment(req.params.id, parsed.data.amount);
    ok(res, { plan });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

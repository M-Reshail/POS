/**
 * Ledger Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as ledgerService from './ledger.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';
import { LedgerPaymentMode } from '@prisma/client';

// ── Validation Schemas ────────────────────────────────────────────────────────

const directPaymentSchema = z.object({
  retailerId: z.string().uuid('Invalid retailer ID.'),
  amount: z.number().positive('Amount must be positive.'),
  paymentMode: z.nativeEnum(LedgerPaymentMode),
  notes: z.string().trim().optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ERROR_MAP = {
  RETAILER_NOT_FOUND: { status: 404, message: 'Retailer not found.' },
  PAYMENT_EXCEEDS_BALANCE: { status: 422, message: 'Payment amount exceeds the outstanding balance.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/ledger — Summary of all retailers' credit positions */
export const getLedgerSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await ledgerService.getLedgerSummary();
    ok(res, { summary });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** GET /api/ledger/retailer/:id — Full ledger for one retailer */
export const getRetailerLedger = async (req: Request, res: Response): Promise<void> => {
  const query = paginationSchema.safeParse(req.query);
  if (!query.success) { badRequest(res, 'Invalid query parameters.'); return; }
  try {
    const ledger = await ledgerService.getRetailerLedgerEntries(
      req.params.id, query.data.limit, query.data.offset
    );
    ok(res, ledger);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** POST /api/ledger/payment — Record a direct payment (not linked to a specific bill) */
export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  const parsed = directPaymentSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const result = await ledgerService.recordDirectPayment(parsed.data);
    created(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/**
 * Bills Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as billService from './bill.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';
import { BillStatus, BillPaymentMode } from '@prisma/client';

// ── Validation Schemas ────────────────────────────────────────────────────────

const billItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required.'), // allows UUID or "rgb-*" strings
  quantity: z.number().positive('Quantity must be positive.'),
  price: z.number().min(0, 'Price must be non-negative.'),
  discount: z.number().min(0).optional().default(0),
});

const createBillSchema = z.object({
  retailerId: z.string().uuid('Invalid retailer ID.'),
  // items may now be empty — an RGB-only bill (e.g. crate return visit) is valid
  items: z.array(billItemSchema).min(0).default([]),
  discount: z.number().min(0).optional().default(0),
  // 'udhar' is excluded — only cash, credit, generate-only allowed for new sales
  // (Old bills with udhar in DB are untouched; this only blocks new creation)
  // Frontend sends 'generate-only' (hyphen); Prisma enum member is 'generate_only' (underscore).
  // The @map in schema.prisma only affects DB storage — the TS client always uses underscore.
  paymentMode: z.enum(['cash', 'credit', 'generate-only']).optional()
    .transform((v) => v === 'generate-only' ? 'generate_only' as const : v),
  paidAmount: z.number().min(0).optional().default(0),
  previousPendingAdded: z.number().min(0).optional(),
  oldPendingPaymentApplied: z.number().min(0).optional(),
  notes: z.string().trim().optional(),
  rgbExchanges: z.array(z.object({
    rgbItemId:      z.string().uuid('Invalid RGB item ID.'),
    cratesGiven:    z.number().int().min(0).default(0),
    cratesReturned: z.number().int().min(0).default(0),
  })).optional().default([]),
  /** Amount the retailer is paying toward old/new udhaar. NOT added to bill total. */
  udhaarPaymentAmount: z.number().min(0).optional(),
  /** Allocation mode. Defaults to 'old_first' on backend if omitted. */
  udhaarPaymentMode: z.enum(['old_first', 'current_first']).optional(),
}).superRefine((data, ctx) => {
  // A bill must have at least one product item OR at least one non-zero RGB exchange.
  const hasProducts = data.items.length > 0;
  const hasRgb = (data.rgbExchanges ?? []).some(
    (e) => e.cratesGiven > 0 || e.cratesReturned > 0
  );
  if (!hasProducts && !hasRgb) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A bill must contain at least one product or a non-zero RGB crate exchange.',
      path: ['items'],
    });
  }
});

const listBillsSchema = z.object({
  retailerId: z.string().uuid().optional(),
  status: z.nativeEnum(BillStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const addPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be positive.'),
  paymentMode: z.nativeEnum(BillPaymentMode).default(BillPaymentMode.cash).optional(),
  notes: z.string().trim().optional(),
});

const voidBillSchema = z.object({
  reason: z.string().min(5, 'A reason of at least 5 characters is required.').trim(),
});

const ERROR_MAP = {
  RETAILER_NOT_FOUND: { status: 404, message: 'Retailer not found.' },
  WORKER_NOT_FOUND: { status: 404, message: 'Worker account not found or inactive.' },
  BILL_NOT_FOUND: { status: 404, message: 'Bill not found.' },
  BILL_ALREADY_PAID: { status: 409, message: 'This bill is already fully paid.' },
  BILL_ALREADY_VOIDED: { status: 409, message: 'This bill has already been voided.' },
  BILL_VOIDED: { status: 409, message: 'Cannot add payment to a voided bill.' },
  BILL_ACCESS_DENIED: { status: 403, message: 'You can only view your own bills.' },
  PAYMENT_EXCEEDS_PENDING: { status: 422, message: 'Payment amount exceeds pending balance.' },
  INSUFFICIENT_RGB_STOCK: { status: 422, message: 'Insufficient warehouse crate stock. The entire sale has been rolled back.' },
  EMPTY_BILL: { status: 422, message: 'A bill must contain at least one product or a non-zero RGB crate exchange.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/bills — Worker creates a bill (or admin).
 * workerId is taken from JWT token to prevent spoofing.
 */
export const createBill = async (req: Request, res: Response): Promise<void> => {
  const parsed = createBillSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const result = await billService.createBill({
      ...parsed.data,
      workerId: req.user!.id, // Always use authenticated user's ID
    });
    created(res, result);
  } catch (error) {
    // Handle dynamic errors like INSUFFICIENT_STOCK:ProductName or PRODUCT_NOT_FOUND:id
    if (error instanceof Error) {
      if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
        const product = error.message.split(':')[1];
        res.status(422).json({ success: false, message: `Insufficient stock for: ${product}` });
        return;
      }
      if (error.message.startsWith('PRODUCT_NOT_FOUND:')) {
        res.status(404).json({ success: false, message: `Product not found: ${error.message.split(':')[1]}` });
        return;
      }
    }
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/bills — Admin sees all; Worker sees only their own */
export const listBills = async (req: Request, res: Response): Promise<void> => {
  const query = listBillsSchema.safeParse(req.query);
  if (!query.success) { badRequest(res, 'Invalid query parameters.'); return; }

  const isAdmin = req.user!.role === 'admin';
  try {
    const result = await billService.getBills({
      workerId: isAdmin ? undefined : req.user!.id, // Workers scoped to own bills
      retailerId: query.data.retailerId,
      status: query.data.status,
      limit: query.data.limit,
      offset: query.data.offset,
    });
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** GET /api/bills/:id — Both roles; Workers restricted to own bills */
export const getBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const bill = await billService.getBillById(req.params.id, req.user!.id, isAdmin);
    ok(res, { bill });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** POST /api/bills/:id/payment — Admin adds payment to an existing bill */
export const addPayment = async (req: Request, res: Response): Promise<void> => {
  const parsed = addPaymentSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const result = await billService.addPayment(req.params.id, parsed.data);
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** POST /api/bills/preview-udhaar-allocation — No DB writes; returns allocation plan */
export const previewUdhaarAllocation = async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    retailerId:   z.string().uuid('Invalid retailer ID.'),
    newBillTotal: z.number().min(0),
    newBillPaid:  z.number().min(0).optional().default(0),
    paymentAmount: z.number().positive('Payment amount must be positive.'),
    mode: z.enum(['old_first', 'current_first']).default('old_first'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const plan = await billService.previewUdhaarAllocation(parsed.data);
    ok(res, { plan });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

/** POST /api/bills/:id/void — Admin voids (soft-cancels) a bill */
export const voidBill = async (req: Request, res: Response): Promise<void> => {
  const parsed = voidBillSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const result = await billService.voidBill(req.params.id, req.user!.id, parsed.data.reason);
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

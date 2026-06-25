/**
 * Inventory Service
 *
 * Manages stock batches — the single source of truth for all product quantities.
 * All sales quantities are deducted from stock batches (FIFO order).
 * Only Admins can add stock or make adjustments; workers read-only.
 *
 * Business Rules enforced:
 *  - Batch-Based Expiry Monitoring (categorised by risk level)
 *  - Justified Stock Adjustments (reason + adminId required)
 *  - FIFO depletion order (purchaseDate ASC)
 */

import { prisma } from '../../lib/prisma';
import { AdjustmentReason, Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateStockBatchInput {
  productId: string;
  quantity: number;
  buyPrice: number;
  salePrice: number;
  batchNumber: string;
  expiryDate: string; // ISO date string
  purchaseDate: string;
  supplierId?: string;
  supplier?: string;
}

export interface AdjustStockInput {
  quantity: number;      // Positive = add, Negative = deduct
  reason: AdjustmentReason;
  notes: string;
  adminId: string;
}

// ── Expiry Risk Classification ────────────────────────────────────────────────

export type ExpiryRisk = 'expired' | 'critical' | 'warning' | 'ok';

const getExpiryRisk = (expiryDate: Date): ExpiryRisk => {
  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 7) return 'critical';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'ok';
};

// ── Service Methods ───────────────────────────────────────────────────────────

/** List all stock batches with product info and expiry risk level */
export const getAllStockBatches = async () => {
  const batches = await prisma.stockBatch.findMany({
    orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      product: {
        select: { id: true, brand: true, category: true, variant: true, petConversionFactor: true },
      },
      _count: { select: { adjustments: true } },
    },
  });

  return batches.map((b) => ({
    ...b,
    expiryRisk: getExpiryRisk(b.expiryDate),
  }));
};

/** Get a single stock batch */
export const getStockBatchById = async (id: string) => {
  const batch = await prisma.stockBatch.findUnique({
    where: { id },
    include: {
      product: true,
      adjustments: {
        include: { admin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!batch) throw new Error('STOCK_BATCH_NOT_FOUND');
  return { ...batch, expiryRisk: getExpiryRisk(batch.expiryDate) };
};

/** Add a new stock batch for an existing product */
export const createStockBatch = async (input: CreateStockBatchInput) => {
  // Validate product exists
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  // Batch number must be unique
  const existing = await prisma.stockBatch.findUnique({
    where: { batchNumber: input.batchNumber },
  });
  if (existing) throw new Error('BATCH_NUMBER_EXISTS');

  return prisma.stockBatch.create({
    data: {
      ...input,
      expiryDate: new Date(input.expiryDate),
      purchaseDate: new Date(input.purchaseDate),
      buyPrice: new Prisma.Decimal(input.buyPrice),
      salePrice: new Prisma.Decimal(input.salePrice),
    },
    include: { product: true },
  });
};

/** Update non-quantity fields of a stock batch (Admin) */
export const updateStockBatch = async (
  id: string,
  input: Partial<Omit<CreateStockBatchInput, 'productId' | 'batchNumber'>>
) => {
  const batch = await prisma.stockBatch.findUnique({ where: { id } });
  if (!batch) throw new Error('STOCK_BATCH_NOT_FOUND');

  const data: Prisma.StockBatchUpdateInput = {};
  if (input.quantity !== undefined) data.quantity = input.quantity;
  if (input.buyPrice !== undefined) data.buyPrice = new Prisma.Decimal(input.buyPrice);
  if (input.salePrice !== undefined) data.salePrice = new Prisma.Decimal(input.salePrice);
  if (input.expiryDate) data.expiryDate = new Date(input.expiryDate);
  if (input.purchaseDate) data.purchaseDate = new Date(input.purchaseDate);
  if (input.supplierId !== undefined) data.supplierId = input.supplierId;
  if (input.supplier !== undefined) data.supplier = input.supplier;

  return prisma.stockBatch.update({ where: { id }, data, include: { product: true } });
};

/**
 * Apply a manual stock adjustment.
 * Business Rule: Must include reason code + admin ID.
 */
export const adjustStock = async (batchId: string, input: AdjustStockInput) => {
  const batch = await prisma.stockBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error('STOCK_BATCH_NOT_FOUND');

  const newQty = batch.quantity + input.quantity;
  if (newQty < 0) throw new Error('INSUFFICIENT_STOCK');

  return prisma.$transaction(async (tx) => {
    const updatedBatch = await tx.stockBatch.update({
      where: { id: batchId },
      data: { quantity: newQty },
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        batchId,
        quantity: input.quantity,
        reason: input.reason,
        notes: input.notes,
        adminId: input.adminId,
      },
      include: {
        admin: { select: { id: true, name: true } },
        batch: { include: { product: { select: { brand: true, variant: true } } } },
      },
    });

    return { batch: updatedBatch, adjustment };
  });
};

/** Get batches with stock below threshold (default 10 PET) */
export const getLowStockBatches = async (threshold = 10) => {
  const batches = await prisma.stockBatch.findMany({
    where: { quantity: { lte: threshold, gt: 0 } },
    include: {
      product: { select: { brand: true, variant: true, category: true } },
    },
    orderBy: { quantity: 'asc' },
  });
  return batches.map((b) => ({ ...b, expiryRisk: getExpiryRisk(b.expiryDate) }));
};

/** Get batches nearing or past their expiry date */
export const getExpiryRiskBatches = async () => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const batches = await prisma.stockBatch.findMany({
    where: {
      expiryDate: { lte: thirtyDaysFromNow },
      quantity: { gt: 0 },
    },
    include: {
      product: { select: { brand: true, variant: true, category: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
  return batches.map((b) => ({ ...b, expiryRisk: getExpiryRisk(b.expiryDate) }));
};

/**
 * INTERNAL — FIFO stock deduction used by the bills service.
 * Deducts `quantity` PET units from the oldest batches of `productId`.
 * Must be called inside a Prisma transaction.
 */
export const deductStockFIFO = async (
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number
): Promise<void> => {
  const batches = await tx.stockBatch.findMany({
    where: { productId, quantity: { gt: 0 } },
    orderBy: { purchaseDate: 'asc' }, // Oldest first
  });

  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.quantity, remaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { quantity: { decrement: deduct } },
    });
    remaining -= deduct;
  }

  if (remaining > 0) {
    throw new Error('INSUFFICIENT_STOCK');
  }
};

/** Get current sale price for a product (latest batch FIFO-first, no expiry filter) */
export const getProductCurrentSalePrice = async (
  tx: Prisma.TransactionClient,
  productId: string
): Promise<number | null> => {
  const batch = await tx.stockBatch.findFirst({
    where: { productId, quantity: { gt: 0 } },
    orderBy: { purchaseDate: 'asc' },
    select: { salePrice: true },
  });
  return batch ? Number(batch.salePrice) : null;
};

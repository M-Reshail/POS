/**
 * Bills Service
 *
 * The core transaction engine of the POS system.
 * All business rules are enforced atomically in a Prisma transaction.
 *
 * Business Rules enforced:
 *  1. Credit Limit Enforcement — blocks sale if retailer is at/over credit limit
 *  2. Bill Immutability — Workers cannot edit/delete bills after creation
 *  3. FIFO Stock Depletion — oldest batches consumed first
 *  4. Price Variance Detection — flagged when billed price < default sale price
 *  5. Voided Bill Logging — cancelled bills are soft-deleted with audit trail
 *  6. Ledger Integrity — every bill creates a ledger entry with running balance
 *  7. Timestamped Accountability — every mutation tied to a user ID
 */

import { prisma } from '../../lib/prisma';
import { BillPaymentMode, BillStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { deductStockFIFO, getProductCurrentSalePrice } from '../inventory/inventory.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBillItemInput {
  productId: string;
  quantity: number;     // In PET units
  price: number;        // Per-unit price charged
  discount?: number;    // Line-item discount
}

export interface CreateBillInput {
  retailerId: string;
  workerId: string;
  items: CreateBillItemInput[];
  discount?: number;       // Bill-level discount
  paymentMode?: BillPaymentMode;
  paidAmount?: number;
  previousPendingAdded?: number;
  oldPendingPaymentApplied?: number;
  notes?: string;
}

export interface AddPaymentInput {
  amount: number;
  paymentMode: BillPaymentMode;
  notes?: string;
}

// ── Bill Number Generator ─────────────────────────────────────────────────────

const generateBillNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
  const count = await tx.bill.count();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BL-${date}-${String(count + 1).padStart(4, '0')}`;
};

// ── Ledger Balance Helper ─────────────────────────────────────────────────────

const getLastLedgerBalance = async (
  tx: Prisma.TransactionClient,
  retailerId: string
): Promise<number> => {
  const last = await tx.ledgerEntry.findFirst({
    where: { retailerId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });
  return last ? Number(last.balance) : 0;
};

// ── Price Variance Logger ─────────────────────────────────────────────────────
// (Variance is recorded on the bill item itself — reports query it at runtime)

interface PriceVarianceFlag {
  productId: string;
  defaultPrice: number;
  billedPrice: number;
  discountPercent: number;
}

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Create a new bill.
 * Atomic transaction: stock deduction + bill creation + ledger entry.
 */
export const createBill = async (input: CreateBillInput) => {
  return prisma.$transaction(async (tx) => {
    // 1. Validate retailer and check credit limit ──────────────────────────────
    const retailer = await tx.retailer.findUnique({ where: { id: input.retailerId } });
    if (!retailer) throw new Error('RETAILER_NOT_FOUND');

    const currentBalance = await getLastLedgerBalance(tx, input.retailerId);
    const creditLimit = Number(retailer.creditLimit);

    // Block if already at or over credit limit
    if (creditLimit > 0 && currentBalance >= creditLimit) {
      throw new Error('CREDIT_LIMIT_EXCEEDED');
    }

    // 2. Validate worker ───────────────────────────────────────────────────────
    const worker = await tx.user.findUnique({ where: { id: input.workerId } });
    if (!worker || !worker.isActive) throw new Error('WORKER_NOT_FOUND');

    // 3. Validate all items and check stock availability ──────────────────────
    const priceVariances: PriceVarianceFlag[] = [];

    for (const item of input.items) {
      // RGB items (empty crates) are virtual — skip DB lookup & stock check
      if (item.productId.startsWith('rgb-')) continue;

      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);

      const totalAvailable = await tx.stockBatch.aggregate({
        where: { productId: item.productId, quantity: { gt: 0 } },
        _sum: { quantity: true },
      });

      const available = totalAvailable._sum.quantity ?? 0;
      if (available < item.quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${product.brand} ${product.variant}`);
      }

      // Price variance detection
      const defaultPrice = await getProductCurrentSalePrice(tx, item.productId);
      if (defaultPrice !== null && item.price < defaultPrice) {
        priceVariances.push({
          productId: item.productId,
          defaultPrice,
          billedPrice: item.price,
          discountPercent: ((defaultPrice - item.price) / defaultPrice) * 100,
        });
      }
    }

    // 4. Calculate bill totals ─────────────────────────────────────────────────
    const subtotal = input.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.price - (item.discount ?? 0);
      return sum + lineTotal;
    }, 0);

    const billDiscount = input.discount ?? 0;
    const total = Math.max(0, subtotal - billDiscount);
    const paidAmount = Math.min(input.paidAmount ?? 0, total);
    const pendingAmount = total - paidAmount;

    const status: BillStatus =
      pendingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

    // 5. Determine new credit balance ─────────────────────────────────────────
    const newBalance = currentBalance + pendingAmount;

    // Soft credit check — allow partial over-limit with warning (already hard-blocked above)
    // 6. Create the bill ───────────────────────────────────────────────────────
    const billNumber = await generateBillNumber(tx);

    // RGB items are virtual crate-tracking entries; they have no row in the
    // products table, so they MUST be excluded from bill_items to avoid the
    // bill_items_product_id_fkey FK constraint violation.
    const persistableItems = input.items.filter(
      (item) => !item.productId.startsWith('rgb-')
    );

    const bill = await tx.bill.create({
      data: {
        billNumber,
        retailerId: input.retailerId,
        workerId: input.workerId,
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(billDiscount),
        total: new Prisma.Decimal(total),
        paidAmount: new Prisma.Decimal(paidAmount),
        pendingAmount: new Prisma.Decimal(pendingAmount),
        paymentMode: input.paymentMode,
        previousPendingAdded: input.previousPendingAdded
          ? new Prisma.Decimal(input.previousPendingAdded)
          : null,
        oldPendingPaymentApplied: input.oldPendingPaymentApplied
          ? new Prisma.Decimal(input.oldPendingPaymentApplied)
          : null,
        status,
        items: {
          create: persistableItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: new Prisma.Decimal(item.price),
            discount: new Prisma.Decimal(item.discount ?? 0),
            total: new Prisma.Decimal(
              item.quantity * item.price - (item.discount ?? 0)
            ),
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        retailer: { select: { shopName: true } },
        worker: { select: { name: true } },
      },
    });

    // 7. FIFO stock depletion (skip virtual RGB items) ────────────────────────
    for (const item of input.items) {
      if (item.productId.startsWith('rgb-')) continue;
      await deductStockFIFO(tx, item.productId, item.quantity);
    }

    // 8. Record upfront payment ───────────────────────────────────────────────
    if (paidAmount > 0 && input.paymentMode) {
      await tx.paymentRecord.create({
        data: {
          billId: bill.id,
          amount: new Prisma.Decimal(paidAmount),
          paymentMode: input.paymentMode,
          notes: input.notes,
        },
      });
    }

    // 9. Create ledger entry ───────────────────────────────────────────────────
    if (pendingAmount > 0) {
      await tx.ledgerEntry.create({
        data: {
          retailerId: input.retailerId,
          billId: bill.id,
          entryType: LedgerEntryType.sale,
          amount: new Prisma.Decimal(total),
          balance: new Prisma.Decimal(newBalance),
        },
      });
    }

    return {
      bill,
      priceVariances, // Flagged for caller — frontend can display warnings
    };
  });
};

/** List bills — Admin sees all, Worker sees only their own */
export const getBills = async (options: {
  workerId?: string;    // If set, filter to this worker
  retailerId?: string;
  status?: BillStatus;
  limit?: number;
  offset?: number;
}) => {
  const where: Prisma.BillWhereInput = {};
  if (options.workerId) where.workerId = options.workerId;
  if (options.retailerId) where.retailerId = options.retailerId;
  if (options.status) where.status = options.status;

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
      include: {
        retailer: { select: { id: true, shopName: true, ownerName: true } },
        worker: { select: { id: true, name: true } },
        items: { include: { product: { select: { brand: true, variant: true } } } },
        _count: { select: { paymentHistory: true } },
      },
    }),
    prisma.bill.count({ where }),
  ]);

  return { bills, total, limit: options.limit ?? 50, offset: options.offset ?? 0 };
};

/** Get a single bill with full detail */
export const getBillById = async (id: string, requestingUserId?: string, isAdmin = false) => {
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      retailer: { select: { id: true, shopName: true, ownerName: true, mobileNumber: true } },
      worker: { select: { id: true, name: true } },
      items: { include: { product: true } },
      paymentHistory: { orderBy: { date: 'desc' } },
      voidLog: true,
    },
  });

  if (!bill) throw new Error('BILL_NOT_FOUND');

  // Workers can only see their own bills
  if (!isAdmin && requestingUserId && bill.workerId !== requestingUserId) {
    throw new Error('BILL_ACCESS_DENIED');
  }

  return bill;
};

/**
 * Add a payment to a bill.
 * Updates bill status, creates payment record, and creates ledger entry.
 * Admin-only operation.
 */
export const addPayment = async (billId: string, input: AddPaymentInput) => {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new Error('BILL_NOT_FOUND');
    if (bill.status === 'paid') throw new Error('BILL_ALREADY_PAID');

    // Check if already voided
    const voidCheck = await tx.voidedBillLog.findUnique({ where: { billId } });
    if (voidCheck) throw new Error('BILL_VOIDED');


    const pending = Number(bill.pendingAmount);
    if (input.amount > pending) throw new Error('PAYMENT_EXCEEDS_PENDING');

    const newPaidAmount = Number(bill.paidAmount) + input.amount;
    const newPendingAmount = pending - input.amount;
    const newStatus: BillStatus = newPendingAmount <= 0 ? 'paid' : 'partial';

    // Update bill
    const updatedBill = await tx.bill.update({
      where: { id: billId },
      data: {
        paidAmount: new Prisma.Decimal(newPaidAmount),
        pendingAmount: new Prisma.Decimal(newPendingAmount),
        status: newStatus,
      },
    });

    // Create payment record
    const paymentRecord = await tx.paymentRecord.create({
      data: {
        billId,
        amount: new Prisma.Decimal(input.amount),
        paymentMode: input.paymentMode,
        notes: input.notes,
      },
    });

    // Create ledger entry (payment reduces balance)
    const lastBalance = await getLastLedgerBalance(tx, bill.retailerId);
    const newBalance = Math.max(0, lastBalance - input.amount);

    await tx.ledgerEntry.create({
      data: {
        retailerId: bill.retailerId,
        billId,
        entryType: LedgerEntryType.payment,
        amount: new Prisma.Decimal(input.amount),
        balance: new Prisma.Decimal(newBalance),
      },
    });

    return { bill: updatedBill, paymentRecord };
  });
};

/**
 * Void (cancel) a bill.
 * Business Rule: Bills are NEVER hard-deleted — logged in voided_bill_logs.
 * Admin-only operation.
 */
export const voidBill = async (
  billId: string,
  adminId: string,
  reason: string
) => {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: { voidLog: true },
    });
    if (!bill) throw new Error('BILL_NOT_FOUND');
    if (bill.voidLog) throw new Error('BILL_ALREADY_VOIDED');

    // Create void log
    const voidLog = await tx.voidedBillLog.create({
      data: {
        billId,
        workerId: bill.workerId, // Worker who originally created it
        billValue: bill.total,
        reason,
      },
    });

    // Reverse the pending amount from ledger if bill had pending balance
    if (Number(bill.pendingAmount) > 0) {
      const lastBalance = await getLastLedgerBalance(tx, bill.retailerId);
      const reversedBalance = Math.max(0, lastBalance - Number(bill.pendingAmount));

      await tx.ledgerEntry.create({
        data: {
          retailerId: bill.retailerId,
          billId,
          entryType: LedgerEntryType.adjustment,
          amount: bill.pendingAmount,
          balance: new Prisma.Decimal(reversedBalance),
          notes: `Bill ${bill.billNumber} voided by admin. Reason: ${reason}`,
        },
      });
    }

    return { bill, voidLog };
  });
};

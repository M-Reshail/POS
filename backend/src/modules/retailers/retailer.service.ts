/**
 * Retailers Service
 *
 * Manages retail shop accounts.
 * Includes outstanding balance computation and RGB crate tracking.
 */

import { prisma } from '../../lib/prisma';
import { BillPaymentMode, BillStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { allocateFifoPayment } from '../../lib/fifoPaymentAllocator';
import type { BillSnapshot, AllocationPlan } from '../../lib/udhaarAllocator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRetailerInput {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation?: string;
}

export interface UpdateRetailerInput extends Partial<CreateRetailerInput> {}

// ── Retailer Outstanding Balance ──────────────────────────────────────────────

const getRetailerOutstanding = async (retailerId: string): Promise<number> => {
  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: { retailerId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });
  return lastEntry ? Number(lastEntry.balance) : 0;
};

// ── Service Methods ───────────────────────────────────────────────────────────

/** List all retailers with outstanding balance */
export const getAllRetailers = async () => {
  const retailers = await prisma.retailer.findMany({
    orderBy: { shopName: 'asc' },
    include: {
      rgbBalances: { include: { rgbItem: true } },
      _count: { select: { bills: true } },
    },
  });

  return Promise.all(
    retailers.map(async (r) => {
      const outstanding = await getRetailerOutstanding(r.id);
      return {
        ...r,
        outstanding,
      };
    })
  );
};

/** Get a single retailer with full detail */
export const getRetailerById = async (id: string) => {
  const retailer = await prisma.retailer.findUnique({
    where: { id },
    include: { rgbBalances: { include: { rgbItem: true } } },
  });
  if (!retailer) throw new Error('RETAILER_NOT_FOUND');

  const outstanding = await getRetailerOutstanding(id);
  return {
    ...retailer,
    outstanding,
  };
};

/** Create a new retailer */
export const createRetailer = async (input: CreateRetailerInput) => {
  return prisma.retailer.create({
    data: { ...input },
  });
};

/** Update retailer profile */
export const updateRetailer = async (id: string, input: UpdateRetailerInput) => {
  const exists = await prisma.retailer.findUnique({ where: { id } });
  if (!exists) throw new Error('RETAILER_NOT_FOUND');

  const data: Prisma.RetailerUpdateInput = { ...input };

  return prisma.retailer.update({ where: { id }, data });
};

/** Get paginated ledger entries for a retailer */
export const getRetailerLedger = async (
  retailerId: string,
  limit = 50,
  offset = 0,
  startDate?: string,
  endDate?: string
) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) throw new Error('RETAILER_NOT_FOUND');

  const whereClause: Prisma.LedgerEntryWhereInput = { retailerId };
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  const [entries, total, outstanding] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        bill: { select: { id: true, billNumber: true, total: true, pendingAmount: true, status: true } },
      },
    }),
    prisma.ledgerEntry.count({ where: whereClause }),
    getRetailerOutstanding(retailerId),
  ]);

  return {
    retailer: {
      id: retailer.id,
      shopName: retailer.shopName,
      ownerName: retailer.ownerName,
    },
    outstanding,
    entries,
    pagination: { total, limit, offset },
  };
};

/**
 * Record a FIFO retailer-level payment against all pending/partial bills.
 *
 * Algorithm:
 *  1. Fetch all PENDING/PARTIAL bills (pendingAmount > 0, not voided) sorted by
 *     createdAt ASC (oldest first).
 *  2. Run the pure FIFO allocator to compute how much goes to each bill.
 *  3. Inside a single Prisma $transaction:
 *     - Update each touched bill's paidAmount / pendingAmount / status
 *     - Create a PaymentRecord for each touched bill (preserves full payment history)
 *     - Create a LedgerEntry for each touched bill with chained running balance
 *  4. Return the AllocationPlan for display.
 */
export const recordRetailerPayment = async (
  retailerId: string,
  paymentAmount: number,
): Promise<AllocationPlan> => {
  const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) throw new Error('RETAILER_NOT_FOUND');

  if (paymentAmount <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');

  // Fetch pending/partial bills in FIFO order (oldest first)
  const pendingRows = await prisma.bill.findMany({
    where: {
      retailerId,
      pendingAmount: { gt: 0 },
      voidLog: { is: null },
    },
    select: {
      id: true,
      billNumber: true,
      pendingAmount: true,
      paidAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingRows.length === 0) throw new Error('NO_PENDING_BILLS');

  const snapshots: BillSnapshot[] = pendingRows.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    pendingAmount: Number(b.pendingAmount),
    createdAt: b.createdAt,
  }));

  const plan = allocateFifoPayment(snapshots, paymentAmount);

  if (plan.entries.length === 0) return plan;

  await prisma.$transaction(async (tx) => {
    // Get the current ledger running balance as the starting point
    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { retailerId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });
    let runningBalance = lastEntry ? Number(lastEntry.balance) : 0;

    for (const entry of plan.entries) {
      // a) Find the original paid amount to compute new total
      const originalRow = pendingRows.find((r) => r.id === entry.billId)!;
      const newPaidAmount = Number(originalRow.paidAmount) + entry.amountApplied;

      // b) Update bill financial state
      await tx.bill.update({
        where: { id: entry.billId },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount),
          pendingAmount: new Prisma.Decimal(entry.pendingAfter),
          status: entry.newStatus as BillStatus,
        },
      });

      // c) Create PaymentRecord — each bill gets its own dated record so
      //    ExpandableBillRow's payment-history dropdown shows the full history
      //    (multiple payments on different dates are all preserved here).
      await tx.paymentRecord.create({
        data: {
          billId: entry.billId,
          amount: new Prisma.Decimal(entry.amountApplied),
          paymentMode: BillPaymentMode.cash,
          notes: `Retailer-level FIFO payment`,
        },
      });

      // d) Create LedgerEntry with chained running balance
      runningBalance = Math.max(0, runningBalance - entry.amountApplied);
      await tx.ledgerEntry.create({
        data: {
          retailerId,
          billId: entry.billId,
          entryType: LedgerEntryType.payment,
          amount: new Prisma.Decimal(entry.amountApplied),
          balance: new Prisma.Decimal(runningBalance),
          notes: `Retailer-level FIFO payment`,
        },
      });
    }
  });

  return plan;
};

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
 *  8. RGB-Only Bills Allowed — empty product cart is valid if rgbExchanges has at
 *     least one non-zero entry (e.g. a retailer dropping off crates with no purchase)
 *  9. Udhaar Payment Allocation — optional udhaarPaymentAmount entered at bill
 *     creation applies against old pending bills (LIFO) and/or the new bill,
 *     creating per-bill PaymentRecord and LedgerEntry rows atomically.
 */

import { prisma } from '../../lib/prisma';
import { BillPaymentMode, BillStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { deductStockFIFO, getProductCurrentSalePrice } from '../inventory/inventory.service';
import { issueRGB, returnRGB } from '../rgb/rgb.service';
import {
  allocateUdhaarPayment,
  UdhaarAllocationMode,
  BillSnapshot,
  AllocationPlan,
} from '../../lib/udhaarAllocator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBillItemInput {
  productId: string;
  quantity: number;     // In PET units
  price: number;        // Per-unit price charged
  discount?: number;    // Line-item discount
}

export interface RGBExchangeInput {
  rgbItemId: string;
  cratesGiven: number;    // crates issued to retailer (warehouse stock decreases)
  cratesReturned: number; // crates collected from retailer (warehouse stock increases)
}

export interface CreateBillInput {
  retailerId: string;
  workerId: string;
  items: CreateBillItemInput[];
  discount?: number;              // Bill-level discount
  paymentMode?: BillPaymentMode;
  paidAmount?: number;
  /** @deprecated Use udhaarPaymentAmount instead. Kept for backward compat with old data. */
  previousPendingAdded?: number;
  oldPendingPaymentApplied?: number;
  notes?: string;
  rgbExchanges?: RGBExchangeInput[]; // Standalone crate exchanges for this sale
  /** Amount the retailer is paying toward old (and/or new) pending bills. */
  udhaarPaymentAmount?: number;
  /** Allocation strategy. Default: 'old_first' (old bills paid before new bill). */
  udhaarPaymentMode?: UdhaarAllocationMode;
}

export interface AddPaymentInput {
  amount: number;
  paymentMode?: BillPaymentMode;
  notes?: string;
}

/** Input for the read-only allocation preview (no DB writes). */
export interface PreviewUdhaarAllocationInput {
  retailerId: string;
  newBillTotal: number;   // total of the new bill being composed
  newBillPaid?: number;   // cash already paid on the new bill
  paymentAmount: number;
  mode: UdhaarAllocationMode;
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
 * Atomic transaction: stock deduction + bill creation + ledger entry
 * + optional udhaar payment allocation against old pending bills.
 */
export const createBill = async (input: CreateBillInput) => {
  const hasProducts = input.items.length > 0;
  const hasRgb = (input.rgbExchanges ?? []).some(
    (e) => e.cratesGiven > 0 || e.cratesReturned > 0
  );

  // 0. Guard: bill must have at least one product OR one non-zero RGB exchange
  if (!hasProducts && !hasRgb) throw new Error('EMPTY_BILL');

  return prisma.$transaction(async (tx) => {
    // 1. Validate retailer ────────────────────────────────────────────────────
    const retailer = await tx.retailer.findUnique({ where: { id: input.retailerId } });
    if (!retailer) throw new Error('RETAILER_NOT_FOUND');

    const currentBalance = await getLastLedgerBalance(tx, input.retailerId);

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
    // NOTE: udhaarPaymentAmount is NOT added to the total. It is a payment
    // against old/new pending bills — it does NOT inflate the new sale amount.
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

    // 5. Determine new credit balance after this bill ─────────────────────────
    const newBalance = currentBalance + pendingAmount;

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
        workerId:   input.workerId,
        subtotal:   new Prisma.Decimal(subtotal),
        discount:   new Prisma.Decimal(billDiscount),
        total:      new Prisma.Decimal(total),
        paidAmount: new Prisma.Decimal(paidAmount),
        pendingAmount: new Prisma.Decimal(pendingAmount),
        paymentMode:  input.paymentMode,
        // previousPendingAdded is kept for backward-compat display of old bills only;
        // new bills always null here — allocation tracked via oldPendingPaymentApplied.
        previousPendingAdded: null,
        // Will be updated below after allocation runs
        oldPendingPaymentApplied: null,
        status,
        items: {
          create: persistableItems.map((item) => ({
            productId: item.productId,
            quantity:  item.quantity,
            price:     new Prisma.Decimal(item.price),
            discount:  new Prisma.Decimal(item.discount ?? 0),
            total:     new Prisma.Decimal(
              item.quantity * item.price - (item.discount ?? 0)
            ),
          })),
        },
      },
      include: {
        items:    { include: { product: true } },
        retailer: { select: { shopName: true } },
        worker:   { select: { name: true } },
      },
    });

    // 7. FIFO stock depletion (skip virtual RGB items) ────────────────────────
    for (const item of input.items) {
      if (item.productId.startsWith('rgb-')) continue;
      await deductStockFIFO(tx, item.productId, item.quantity);
    }

    // 7b. RGB crate exchange processing ──────────────────────────────────────
    // Runs inside the same tx — any INSUFFICIENT_RGB_STOCK error from issueRGB
    // automatically rolls back the entire sale (stock, bill, ledger, everything).
    if (input.rgbExchanges && input.rgbExchanges.length > 0) {
      for (const exchange of input.rgbExchanges) {
        if (exchange.cratesGiven > 0) {
          await issueRGB(tx, {
            retailerId: input.retailerId,
            rgbItemId:  exchange.rgbItemId,
            quantity:   exchange.cratesGiven,
            saleId:     bill.id,
            workerId:   input.workerId,
          });
        }
        if (exchange.cratesReturned > 0) {
          await returnRGB(tx, {
            retailerId: input.retailerId,
            rgbItemId:  exchange.rgbItemId,
            quantity:   exchange.cratesReturned,
            saleId:     bill.id,
            workerId:   input.workerId,
          });
        }
      }
    }

    // 8. Record upfront payment on the NEW bill ────────────────────────────────
    if (paidAmount > 0 && input.paymentMode) {
      await tx.paymentRecord.create({
        data: {
          billId:      bill.id,
          amount:      new Prisma.Decimal(paidAmount),
          paymentMode: input.paymentMode,
          notes:       input.notes,
        },
      });
    }

    // 9. Create sale ledger entry for the new bill ─────────────────────────────
    if (pendingAmount > 0) {
      await tx.ledgerEntry.create({
        data: {
          retailerId: input.retailerId,
          billId:     bill.id,
          entryType:  LedgerEntryType.sale,
          amount:     new Prisma.Decimal(total),
          balance:    new Prisma.Decimal(newBalance),
        },
      });
    }

    // 10. Udhaar payment allocation ───────────────────────────────────────────
    // If a udhaarPaymentAmount is provided, allocate it across old pending bills
    // and/or the new bill, then write the per-bill PaymentRecord + LedgerEntry.
    let allocationPlan: AllocationPlan | null = null;

    if (input.udhaarPaymentAmount && input.udhaarPaymentAmount > 0) {
      const mode: UdhaarAllocationMode = input.udhaarPaymentMode ?? 'old_first';

      // Fetch all PENDING/PARTIAL bills for this retailer EXCLUDING the new bill
      const oldPendingRows = await tx.bill.findMany({
        where: {
          retailerId:    input.retailerId,
          id:            { not: bill.id },
          pendingAmount: { gt: 0 },
          voidLog:       { is: null }, // exclude voided bills
        },
        select: {
          id:            true,
          billNumber:    true,
          pendingAmount: true,
          createdAt:     true,
        },
        orderBy: { createdAt: 'asc' }, // FIFO — allocator sorts oldest-first, pass asc for consistency
      });

      const oldSnapshots: BillSnapshot[] = oldPendingRows.map((b) => ({
        id:            b.id,
        billNumber:    b.billNumber,
        pendingAmount: Number(b.pendingAmount),
        createdAt:     b.createdAt,
      }));

      // New bill snapshot — only include if it still has pending amount
      const newBillSnapshot: BillSnapshot | null = pendingAmount > 0
        ? { id: bill.id, billNumber, pendingAmount, createdAt: bill.createdAt }
        : null;

      allocationPlan = allocateUdhaarPayment(
        oldSnapshots,
        newBillSnapshot,
        input.udhaarPaymentAmount,
        mode
      );

      // Running ledger balance after this allocation (chain from newBalance)
      let runningBalance = newBalance;

      for (const entry of allocationPlan.entries) {
        const isNewBill = entry.billId === bill.id;

        // a) Update the bill's paid/pending/status
        const newPaidAmount = isNewBill
          ? paidAmount + entry.amountApplied
          : Number((await tx.bill.findUnique({
              where: { id: entry.billId },
              select: { paidAmount: true },
            }))!.paidAmount) + entry.amountApplied;

        await tx.bill.update({
          where: { id: entry.billId },
          data: {
            paidAmount:    new Prisma.Decimal(newPaidAmount),
            pendingAmount: new Prisma.Decimal(entry.pendingAfter),
            status:        entry.newStatus,
          },
        });

        // b) Create a PaymentRecord for this specific bill
        await tx.paymentRecord.create({
          data: {
            billId:      entry.billId,
            amount:      new Prisma.Decimal(entry.amountApplied),
            // Udhaar allocation payments are recorded as cash mode by default;
            // the cash was collected at the time of the new sale.
            paymentMode: input.paymentMode ?? 'cash',
            notes:       `Udhaar allocation from bill ${billNumber}`,
          },
        });

        // c) Create a LedgerEntry (payment type) with chained running balance
        runningBalance = Math.max(0, runningBalance - entry.amountApplied);
        await tx.ledgerEntry.create({
          data: {
            retailerId: input.retailerId,
            billId:     entry.billId,
            entryType:  LedgerEntryType.payment,
            amount:     new Prisma.Decimal(entry.amountApplied),
            balance:    new Prisma.Decimal(runningBalance),
            notes:      `Udhaar allocation from bill ${billNumber}`,
          },
        });
      }

      // d) Record totalApplied on the new bill for receipt display
      if (allocationPlan.totalApplied > 0) {
        await tx.bill.update({
          where: { id: bill.id },
          data:  { oldPendingPaymentApplied: new Prisma.Decimal(allocationPlan.totalApplied) },
        });
      }
    }

    // 11. Fetch post-allocation bill state and remaining other pending bills ──
    const finalBill = await tx.bill.findUnique({
      where: { id: bill.id },
      include: {
        items:    { include: { product: true } },
        retailer: { select: { id: true, shopName: true, ownerName: true, mobileNumber: true } },
        worker:   { select: { id: true, name: true } },
      },
    });

    const otherPendingBills = await tx.bill.findMany({
      where: {
        retailerId:    input.retailerId,
        id:            { not: bill.id },
        pendingAmount: { gt: 0 },
        voidLog:       { is: null },
      },
      select: {
        id:            true,
        billNumber:    true,
        total:         true,
        paidAmount:    true,
        pendingAmount: true,
        status:        true,
        createdAt:     true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      bill: finalBill ?? bill,
      priceVariances,   // Flagged for caller — frontend can display warnings
      allocationPlan,   // null if no udhaar payment was requested
      otherPendingBills, // truly updated post-allocation pending bills for this retailer
    };
  });
};

/**
 * Preview how a udhaar payment would be allocated — NO DB writes.
 * Called by the frontend to show the worker the allocation breakdown before submitting.
 */
export const previewUdhaarAllocation = async (
  input: PreviewUdhaarAllocationInput
): Promise<AllocationPlan> => {
  // Fetch current pending bills for this retailer
  const pendingRows = await prisma.bill.findMany({
    where: {
      retailerId:    input.retailerId,
      pendingAmount: { gt: 0 },
      voidLog:       { is: null },
    },
    select: {
      id:            true,
      billNumber:    true,
      pendingAmount: true,
      createdAt:     true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const oldSnapshots: BillSnapshot[] = pendingRows.map((b) => ({
    id:            b.id,
    billNumber:    b.billNumber,
    pendingAmount: Number(b.pendingAmount),
    createdAt:     b.createdAt,
  }));

  // Synthesise a snapshot for the new bill (not yet in DB)
  const newBillPending = Math.max(0, input.newBillTotal - (input.newBillPaid ?? 0));
  const newBillSnapshot: BillSnapshot | null = newBillPending > 0
    ? { id: '__new__', billNumber: '(this bill)', pendingAmount: newBillPending, createdAt: new Date() }
    : null;

  return allocateUdhaarPayment(oldSnapshots, newBillSnapshot, input.paymentAmount, input.mode);
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

  // Attach RGB exchange data — one batch query, then group by saleId.
  // RGBTransaction.saleId is a loose string FK to Bill.id.
  const billIds = bills.map((b) => b.id);
  const rgbTxns = billIds.length > 0
    ? await prisma.rGBTransaction.findMany({
        where: { saleId: { in: billIds } },
        include: { rgbItem: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  // Group by saleId
  const rgbBySaleId = new Map<string, typeof rgbTxns>();
  for (const t of rgbTxns) {
    if (!t.saleId) continue;
    if (!rgbBySaleId.has(t.saleId)) rgbBySaleId.set(t.saleId, []);
    rgbBySaleId.get(t.saleId)!.push(t);
  }

  // Merge into bills
  const billsWithRGB = bills.map((b) => ({
    ...b,
    rgbExchanges: (rgbBySaleId.get(b.id) ?? []).map((t) => ({
      id:        t.id,
      type:      t.type.toLowerCase() as 'issue' | 'return',
      quantity:  t.quantity,
      rgbItemId: t.rgbItemId,
      itemName:  t.rgbItem.name,
      createdAt: t.createdAt,
    })),
  }));

  return { bills: billsWithRGB, total, limit: options.limit ?? 50, offset: options.offset ?? 0 };
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

  // Attach RGB exchange transactions for this bill
  const rgbTxns = await prisma.rGBTransaction.findMany({
    where: { saleId: id },
    include: { rgbItem: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return {
    ...bill,
    rgbExchanges: rgbTxns.map((t) => ({
      id:        t.id,
      type:      t.type.toLowerCase() as 'issue' | 'return',
      quantity:  t.quantity,
      rgbItemId: t.rgbItemId,
      itemName:  t.rgbItem.name,
      createdAt: t.createdAt,
    })),
  };
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
        paymentMode: input.paymentMode ?? BillPaymentMode.cash,
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

/**
 * RGB Items Service
 *
 * Manages Returnable Glass Bottle (crate) stock via the RGBItem model.
 * RGBItems are standalone — not linked to the Product catalog.
 *
 * Flat CRUD:         getAllRGBItems, getRGBItemById, createRGBItem, updateRGBItem, deleteRGBItem
 * Transaction helpers: issueRGB, returnRGB  (called inside a Prisma tx by bill.service / controller)
 * Standalone query:    getRetailerRGBBalances
 */

import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRGBItemInput {
  name: string;
  stockQuantity?: number;
}

export interface UpdateRGBItemInput {
  name?: string;
  stockQuantity?: number;
}

export interface IssueRGBInput {
  retailerId: string;
  rgbItemId: string;
  quantity: number;
  saleId?: string;
  workerId?: string;
}

export interface ReturnRGBInput {
  retailerId: string;
  rgbItemId: string;
  quantity: number;
  workerId?: string;
}

// ── Flat CRUD ─────────────────────────────────────────────────────────────────

/** Get all RGB items sorted by name */
export const getAllRGBItems = async () => {
  return prisma.rGBItem.findMany({
    orderBy: { name: 'asc' },
  });
};

/** Get a single RGB item by id */
export const getRGBItemById = async (id: string) => {
  return prisma.rGBItem.findUnique({ where: { id } });
};

/** Create a new RGB item */
export const createRGBItem = async (input: CreateRGBItemInput) => {
  const existing = await prisma.rGBItem.findUnique({ where: { name: input.name } });
  if (existing) throw new Error('RGB_ITEM_ALREADY_EXISTS');

  return prisma.rGBItem.create({
    data: {
      name: input.name,
      stockQuantity: input.stockQuantity ?? 0,
    },
  });
};

/** Update name and/or directly set stockQuantity (for corrections) */
export const updateRGBItem = async (id: string, input: UpdateRGBItemInput) => {
  const item = await prisma.rGBItem.findUnique({ where: { id } });
  if (!item) throw new Error('RGB_ITEM_NOT_FOUND');

  // Name-uniqueness check if renaming
  if (input.name && input.name !== item.name) {
    const conflict = await prisma.rGBItem.findUnique({ where: { name: input.name } });
    if (conflict) throw new Error('RGB_ITEM_ALREADY_EXISTS');
  }

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.stockQuantity !== undefined) data.stockQuantity = Math.max(0, input.stockQuantity);

  return prisma.rGBItem.update({ where: { id }, data });
};

/**
 * Delete an RGB item.
 * Blocked if any RGBRetailerBalance for this item has balance > 0
 * (crates still owed by retailers — must be resolved first).
 */
export const deleteRGBItem = async (id: string) => {
  const item = await prisma.rGBItem.findUnique({ where: { id } });
  if (!item) throw new Error('RGB_ITEM_NOT_FOUND');

  const outstanding = await prisma.rGBRetailerBalance.findFirst({
    where: { rgbItemId: id, balance: { gt: 0 } },
  });
  if (outstanding) throw new Error('RGB_ITEM_HAS_OUTSTANDING_BALANCES');

  return prisma.rGBItem.delete({ where: { id } });
};

// ── Transaction Helpers ───────────────────────────────────────────────────────

/**
 * issueRGB — Issue crates to a retailer (warehouse stock decreases, retailer balance increases).
 *
 * Must be called inside an existing Prisma transaction (tx).
 *
 * Atomic safety: stock check and decrement happen in one conditional updateMany.
 * If the WHERE clause matches 0 rows the stock was insufficient — we throw
 * INSUFFICIENT_RGB_STOCK, rolling back the entire outer transaction automatically.
 */
export const issueRGB = async (
  tx: Prisma.TransactionClient,
  input: IssueRGBInput
): Promise<void> => {
  const { retailerId, rgbItemId, quantity, saleId, workerId } = input;

  if (quantity <= 0) return;

  // ── Atomic conditional stock decrement ────────────────────────────────────
  // Check and decrement happen in a single SQL UPDATE.
  // If stockQuantity < quantity the WHERE matches 0 rows → count = 0 → throw.
  const stockResult = await tx.rGBItem.updateMany({
    where: { id: rgbItemId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } },
  });

  if (stockResult.count === 0) {
    throw new Error('INSUFFICIENT_RGB_STOCK');
  }

  // ── Upsert retailer balance ───────────────────────────────────────────────
  await tx.rGBRetailerBalance.upsert({
    where: { retailerId_rgbItemId: { retailerId, rgbItemId } },
    create: { retailerId, rgbItemId, balance: quantity },
    update: { balance: { increment: quantity } },
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  await tx.rGBTransaction.create({
    data: {
      retailerId,
      rgbItemId,
      type: 'ISSUE',
      quantity,
      saleId: saleId ?? null,
      workerId: workerId ?? null,
    },
  });
};

/**
 * returnRGB — Collect crates from a retailer (warehouse stock increases, retailer balance decreases).
 *
 * Must be called inside an existing Prisma transaction (tx).
 *
 * Atomic safety — Option A (two-step conditional updateMany):
 *
 *   The decision of HOW MUCH to decrement is never made from a separate read.
 *   Instead:
 *
 *   Step 1 — Try full decrement atomically:
 *     updateMany WHERE balance >= quantity → decrement by quantity.
 *     If 1 row updated: done. actualReturned = quantity.
 *
 *   Step 2 — If step 1 matched 0 rows, balance < quantity (or no record).
 *     First do a plain read to capture the current balance (used only for the
 *     audit log and warehouse increment amount — NOT to gate any further mutation).
 *     Then atomically drain to 0:
 *       updateMany WHERE balance > 0 → SET balance = 0.
 *     If that also matches 0 rows: nothing to return (balance already 0 or no record).
 *     actualReturned = pre-drain balance value.
 *
 *   This structure ensures: no concurrent request can decrement below 0.
 *   Two concurrent returns both in step 2 will race to set balance = 0;
 *   whichever wins first leaves 0 for the loser, which then gets count=0
 *   and exits with actualReturned = 0. Correct.
 *
 *   The read in step 2 (before the drain) is used ONLY to know how many crates
 *   to add back to the warehouse and to record in the audit log. The mutation
 *   decision (cap to 0) is already handled atomically by the WHERE clause.
 */
export const returnRGB = async (
  tx: Prisma.TransactionClient,
  input: ReturnRGBInput
): Promise<void> => {
  const { retailerId, rgbItemId, quantity, workerId } = input;

  if (quantity <= 0) return;

  // ── Step 1: Try full-quantity atomic decrement ────────────────────────────
  const fullResult = await tx.rGBRetailerBalance.updateMany({
    where: { retailerId, rgbItemId, balance: { gte: quantity } },
    data: { balance: { decrement: quantity } },
  });

  let actualReturned: number;

  if (fullResult.count > 0) {
    // Full quantity successfully returned in one atomic op.
    actualReturned = quantity;
  } else {
    // ── Step 2a: Read current balance (informational only) ──────────────────
    // This read is ONLY to know how many crates to return to the warehouse.
    // It does NOT gate any mutation — the atomic drain in step 2b does that.
    const balanceRow = await tx.rGBRetailerBalance.findUnique({
      where: { retailerId_rgbItemId: { retailerId, rgbItemId } },
      select: { balance: true },
    });

    if (!balanceRow || balanceRow.balance <= 0) {
      return; // Nothing to return
    }

    const predrainBalance = balanceRow.balance;

    // ── Step 2b: Atomically drain to exactly 0 ──────────────────────────────
    // WHERE balance > 0 ensures we only proceed if there is something to drain.
    // Two concurrent calls racing here: both read predrainBalance, both attempt
    // this drain. The first one succeeds (count=1), the second finds balance=0
    // and gets count=0, exits with nothing returned. Net: correct.
    const drainResult = await tx.rGBRetailerBalance.updateMany({
      where: { retailerId, rgbItemId, balance: { gt: 0 } },
      data: { balance: 0 },
    });

    if (drainResult.count === 0) {
      // A concurrent request beat us to the drain — nothing left to return.
      return;
    }

    actualReturned = predrainBalance;
  }

  if (actualReturned <= 0) return;

  // ── Increment warehouse stock atomically ──────────────────────────────────
  await tx.rGBItem.update({
    where: { id: rgbItemId },
    data: { stockQuantity: { increment: actualReturned } },
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  await tx.rGBTransaction.create({
    data: {
      retailerId,
      rgbItemId,
      type: 'RETURN',
      quantity: actualReturned,
      workerId: workerId ?? null,
    },
  });
};

// ── Standalone Queries ────────────────────────────────────────────────────────

/**
 * getRetailerRGBBalances — All RGB balances for a retailer (with item names).
 * Non-transactional; safe to call outside a tx.
 */
export const getRetailerRGBBalances = async (retailerId: string) => {
  return prisma.rGBRetailerBalance.findMany({
    where: { retailerId },
    include: { rgbItem: true },
    orderBy: { rgbItem: { name: 'asc' } },
  });
};

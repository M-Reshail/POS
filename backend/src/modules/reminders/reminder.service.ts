/**
 * PaymentReminder Service
 *
 * Business rules enforced here:
 *  - dueDate cannot be in the past on CREATE
 *  - amount must be > 0 (validated at controller layer via Zod)
 *  - retailerId must reference an existing Retailer
 *  - Outstanding validation: cannot create/update a reminder when retailer
 *    has no outstanding balance, or when amount > outstanding (Step 4)
 *  - GET /due returns reminders where dueDate <= now AND status = PENDING
 *    (covers both "due today" and already-overdue ones)
 *    FILTERED: reminders whose retailer's current outstanding <= 0 are excluded
 *    (Step 3 — read-side filter, no rows deleted)
 */

import { prisma } from '../../lib/prisma';
import { ReminderStatus, Prisma } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the current ledger outstanding for a retailer (latest balance). */
const getRetailerOutstanding = async (retailerId: string): Promise<number> => {
  const last = await prisma.ledgerEntry.findFirst({
    where: { retailerId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });
  return last ? Number(last.balance) : 0;
};

/**
 * Build a Set of retailer IDs whose current outstanding is > 0.
 * Used by read-side filters to exclude stale reminders.
 */
const retailerIdsWithOutstanding = async (retailerIds: string[]): Promise<Set<string>> => {
  if (retailerIds.length === 0) return new Set();

  // For each distinct retailer, get the latest ledger entry balance
  const results = await prisma.ledgerEntry.findMany({
    where: { retailerId: { in: retailerIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['retailerId'],
    select: { retailerId: true, balance: true },
  });

  const withOutstanding = new Set<string>();
  for (const r of results) {
    if (Number(r.balance) > 0) withOutstanding.add(r.retailerId);
  }
  return withOutstanding;
};

// ── Create ────────────────────────────────────────────────────────────────────

export const createReminder = async (data: {
  retailerId: string;
  amount: number;
  dueDate: string; // ISO string from request
  note?: string;
  createdById: string;
}) => {
  // Validate dueDate is not in the past (compare date-only, ignore time)
  const due = new Date(data.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) {
    throw new Error('DUE_DATE_IN_PAST');
  }

  // Validate retailer exists
  const retailer = await prisma.retailer.findUnique({
    where: { id: data.retailerId },
    select: { id: true },
  });
  if (!retailer) {
    throw new Error('RETAILER_NOT_FOUND');
  }

  // ── Step 4: validate outstanding ─────────────────────────────────────────
  const outstanding = await getRetailerOutstanding(data.retailerId);
  if (outstanding <= 0) {
    throw new Error('RETAILER_NO_OUTSTANDING');
  }
  if (data.amount > outstanding) {
    throw new Error('REMINDER_AMOUNT_EXCEEDS_OUTSTANDING');
  }

  return prisma.paymentReminder.create({
    data: {
      retailerId: data.retailerId,
      amount: new Prisma.Decimal(data.amount),
      dueDate: due,
      note: data.note,
      createdById: data.createdById,
      // status defaults to PENDING via schema
    },
    include: {
      retailer: { select: { id: true, shopName: true, ownerName: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });
};

// ── List (with optional filters) ──────────────────────────────────────────────

export const listReminders = async (options: {
  status?: ReminderStatus;
  retailerId?: string;
}) => {
  const where: Prisma.PaymentReminderWhereInput = {};
  if (options.status) where.status = options.status;
  if (options.retailerId) where.retailerId = options.retailerId;

  const [reminders, total] = await Promise.all([
    prisma.paymentReminder.findMany({
      where,
      orderBy: { dueDate: 'asc' }, // soonest first
      include: {
        retailer: { select: { id: true, shopName: true, ownerName: true, mobileNumber: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.paymentReminder.count({ where }),
  ]);

  // ── Step 3: exclude reminders whose retailer's outstanding is now <= 0 ───
  // Only filter PENDING / OVERDUE — PAID / CANCELLED rows are unaffected.
  const pendingLike = reminders.filter(
    (r) => r.status === ReminderStatus.PENDING || r.status === ReminderStatus.OVERDUE,
  );
  const retailerIds = [...new Set(pendingLike.map((r) => r.retailerId))];
  const withOutstanding = await retailerIdsWithOutstanding(retailerIds);

  const filtered = reminders.filter(
    (r) =>
      r.status !== ReminderStatus.PENDING && r.status !== ReminderStatus.OVERDUE
        ? true // always include non-pending rows
        : withOutstanding.has(r.retailerId),
  );

  return { reminders: filtered, total: filtered.length };
};

// ── Due / Overdue ─────────────────────────────────────────────────────────────
// Returns all PENDING reminders whose dueDate <= now.
// This covers:
//   • reminders due exactly today
//   • reminders that are already overdue (dueDate < today, never marked PAID)
// FILTERED: reminders whose retailer's current outstanding <= 0 are excluded.

export const getDueReminders = async () => {
  const now = new Date();

  const reminders = await prisma.paymentReminder.findMany({
    where: {
      status: ReminderStatus.PENDING,
      dueDate: { lte: now },
    },
    orderBy: { dueDate: 'asc' }, // oldest overdue first
    include: {
      retailer: { select: { id: true, shopName: true, ownerName: true, mobileNumber: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  // ── Step 3: read-side filter — exclude stale reminders ───────────────────
  const retailerIds = [...new Set(reminders.map((r) => r.retailerId))];
  const withOutstanding = await retailerIdsWithOutstanding(retailerIds);
  const filtered = reminders.filter((r) => withOutstanding.has(r.retailerId));

  return { reminders: filtered, total: filtered.length };
};

// ── Update (PATCH) ────────────────────────────────────────────────────────────

export const updateReminder = async (
  id: string,
  data: {
    amount?: number;
    dueDate?: string;
    note?: string;
    status?: ReminderStatus;
  }
) => {
  // Confirm reminder exists
  const existing = await prisma.paymentReminder.findUnique({ where: { id } });
  if (!existing) throw new Error('REMINDER_NOT_FOUND');

  const updateData: Prisma.PaymentReminderUpdateInput = {};

  if (data.amount !== undefined) {
    // ── Step 4: validate amount update against outstanding ───────────────
    const outstanding = await getRetailerOutstanding(existing.retailerId);
    if (data.amount > outstanding) {
      throw new Error('REMINDER_AMOUNT_EXCEEDS_OUTSTANDING');
    }
    updateData.amount = new Prisma.Decimal(data.amount);
  }
  if (data.dueDate !== undefined) {
    updateData.dueDate = new Date(data.dueDate);
    // ── notificationSent reset ────────────────────────────────────────────────
    // If the due date is being changed and the reminder already fired a push
    // (notificationSent = true), reset it to false so a fresh push fires on
    // the new due date instead of silently skipping it next cycle.
    if (existing.notificationSent) {
      updateData.notificationSent = false; // ← line that resets notificationSent
    }
  }
  if (data.note !== undefined) {
    updateData.note = data.note;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  return prisma.paymentReminder.update({
    where: { id },
    data: updateData,
    include: {
      retailer: { select: { id: true, shopName: true, ownerName: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────

export const deleteReminder = async (id: string) => {
  const existing = await prisma.paymentReminder.findUnique({ where: { id } });
  if (!existing) throw new Error('REMINDER_NOT_FOUND');
  await prisma.paymentReminder.delete({ where: { id } });
  return { deleted: true, id };
};

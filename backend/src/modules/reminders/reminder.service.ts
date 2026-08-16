/**
 * PaymentReminder Service
 *
 * Business rules enforced here:
 *  - dueDate cannot be in the past on CREATE
 *  - amount must be > 0 (validated at controller layer via Zod)
 *  - retailerId must reference an existing Retailer
 *  - GET /due returns reminders where dueDate <= now AND status = PENDING
 *    (covers both "due today" and already-overdue ones)
 */

import { prisma } from '../../lib/prisma';
import { ReminderStatus, Prisma } from '@prisma/client';

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

  return { reminders, total };
};

// ── Due / Overdue ─────────────────────────────────────────────────────────────
// Returns all PENDING reminders whose dueDate <= now.
// This covers:
//   • reminders due exactly today
//   • reminders that are already overdue (dueDate < today, never marked PAID)

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

  return { reminders, total: reminders.length };
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
    updateData.amount = new Prisma.Decimal(data.amount);
  }
  if (data.dueDate !== undefined) {
    updateData.dueDate = new Date(data.dueDate);
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

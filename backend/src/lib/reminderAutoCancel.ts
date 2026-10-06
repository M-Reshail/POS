/**
 * reminderAutoCancel
 *
 * Shared helper: after any payment that reduces a retailer's outstanding,
 * check if outstanding has reached 0 and, if so, cancel all remaining
 * PENDING / OVERDUE reminders for that retailer in the same transaction.
 *
 * Called inside every Prisma $transaction that reduces outstanding:
 *  - retailer.service.recordRetailerPayment
 *  - bill.service.addPayment
 *  - ledger.service.recordDirectPayment
 *
 * No schema changes — uses existing ReminderStatus enum values.
 */

import { Prisma, ReminderStatus } from '@prisma/client';

/**
 * Cancel all PENDING / OVERDUE reminders for `retailerId` if outstanding <= 0.
 * Must be called with a Prisma transaction client so it is atomic with the
 * payment that triggered it.
 *
 * @param tx         — Prisma transaction client
 * @param retailerId — retailer whose balance was just reduced
 */
export const autoCancelRemindersIfPaid = async (
  tx: Prisma.TransactionClient,
  retailerId: string,
): Promise<void> => {
  // Read the retailer's CURRENT outstanding from the latest ledger entry
  // (already written inside this same transaction).
  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { retailerId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });

  const outstanding = lastEntry ? Number(lastEntry.balance) : 0;

  if (outstanding <= 0) {
    await tx.paymentReminder.updateMany({
      where: {
        retailerId,
        status: { in: [ReminderStatus.PENDING, ReminderStatus.OVERDUE] },
      },
      data: { status: ReminderStatus.CANCELLED },
    });
  }
};

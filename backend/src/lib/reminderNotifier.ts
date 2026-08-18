/**
 * Reminder Notifier — Detection Logic Only
 *
 * This module ONLY knows how to detect due reminders.
 * It does NOT know about web-push, Electron, or FCM.
 *
 * notifyDueReminders(deliver):
 *   1. Queries PaymentReminder where:
 *        • status = PENDING
 *        • dueDate <= now
 *        • notificationSent = false
 *   2. For each match, calls deliver(userId, payload)
 *      where userId = reminder.createdById (the person who created the reminder).
 *   3. Marks notificationSent = true after successful delivery.
 *
 * The `deliver` callback is the only coupling point to the delivery mechanism.
 * To use Electron native notifications: pass an Electron IPC deliver fn.
 * To use FCM: pass an FCM deliver fn.
 * No changes needed in this file.
 */

import { prisma } from './prisma';
import { ReminderStatus } from '@prisma/client';
import type { NotificationPayload } from './pushNotifications';

// Pluggable delivery callback type — decouples detection from transport
export type DeliverFn = (userId: string, payload: NotificationPayload) => Promise<void>;

// ── Detection + dispatch ──────────────────────────────────────────────────────

export const notifyDueReminders = async (deliver: DeliverFn): Promise<void> => {
  const now = new Date();

  // Find all PENDING reminders that are due and haven't fired a notification yet
  const dueReminders = await prisma.paymentReminder.findMany({
    where: {
      status:           ReminderStatus.PENDING,
      dueDate:          { lte: now },
      notificationSent: false,
    },
    include: {
      retailer:  { select: { shopName: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (dueReminders.length === 0) return;

  console.log(`[notifier] ${dueReminders.length} due reminder(s) to notify`);

  for (const reminder of dueReminders) {
    const payload: NotificationPayload = {
      title: 'Payment Due — AbdulHaq POS',
      body:  `${reminder.retailer.shopName} — PKR ${Number(reminder.amount).toLocaleString('en-PK')} due`,
    };

    try {
      await deliver(reminder.createdBy.id, payload);

      // Mark as sent so this reminder doesn't fire again next cycle
      await prisma.paymentReminder.update({
        where: { id: reminder.id },
        data:  { notificationSent: true },
      });

      console.log(`[notifier] Notified for reminder ${reminder.id} (${reminder.retailer.shopName})`);
    } catch (err) {
      // Deliver failure for one reminder must not block others
      console.error(`[notifier] Failed to notify for reminder ${reminder.id}:`, err);
    }
  }
};

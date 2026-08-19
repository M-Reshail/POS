/**
 * FIFO Payment Allocator
 *
 * Pure function — zero DB writes, zero side effects.
 * Takes a list of a retailer's pending bills + a payment amount and returns
 * an AllocationPlan describing how much is applied to each bill.
 *
 * Strategy: FIFO — oldest bill (smallest createdAt) is fully satisfied before
 * moving to the next. This is the OPPOSITE ordering from udhaarAllocator (which
 * is LIFO / most-recent-first for legacy udhaar payments during bill creation).
 *
 * If payment exceeds total pending, excessAmount > 0 and totalApplied is
 * capped at total pending — same excess-handling behaviour as udhaarAllocator.
 *
 * Reuses the same AllocationEntry / AllocationPlan types as udhaarAllocator
 * for consistency.
 */

// ── Re-export shared types from udhaarAllocator ───────────────────────────────
// (single source of truth for these shapes)
export type { BillSnapshot, AllocationEntry, AllocationPlan } from './udhaarAllocator';

import type { BillSnapshot, AllocationPlan } from './udhaarAllocator';

// ── Helper ────────────────────────────────────────────────────────────────────

function resolveStatus(pendingAfter: number): 'paid' | 'partial' | 'pending' {
  if (pendingAfter <= 0) return 'paid';
  return 'partial';
}

// ── Core FIFO Allocator ───────────────────────────────────────────────────────

/**
 * Allocate `paymentAmount` across `bills` in FIFO order (oldest createdAt first).
 *
 * @param bills         Pending/partial bills for the retailer. Must have pendingAmount > 0.
 * @param paymentAmount Total amount being paid by the retailer right now.
 */
export function allocateFifoPayment(
  bills: BillSnapshot[],
  paymentAmount: number,
): AllocationPlan {
  if (paymentAmount <= 0) {
    return { entries: [], totalApplied: 0, excessAmount: 0 };
  }

  // FIFO: sort by createdAt ascending (oldest bill first)
  const sorted = [...bills].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const entries: import('./udhaarAllocator').AllocationEntry[] = [];
  let remaining = paymentAmount;

  for (const bill of sorted) {
    if (remaining <= 0) break;
    if (bill.pendingAmount <= 0) continue; // already fully paid; skip

    const apply = Math.min(remaining, bill.pendingAmount);
    const pendingAfter = Math.max(0, bill.pendingAmount - apply);

    entries.push({
      billId:        bill.id,
      billNumber:    bill.billNumber,
      amountApplied: apply,
      pendingBefore: bill.pendingAmount,
      pendingAfter,
      newStatus:     resolveStatus(pendingAfter),
    });

    remaining -= apply;
  }

  const totalApplied = paymentAmount - remaining;
  const excessAmount = Math.max(0, remaining);

  return { entries, totalApplied, excessAmount };
}

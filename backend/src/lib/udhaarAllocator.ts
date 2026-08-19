/**
 * Udhaar Payment Allocator
 *
 * Pure function — zero DB writes, zero side effects.
 * Takes the bills to allocate against + a payment amount + a mode, and returns
 * an AllocationPlan describing exactly how much goes to each bill.
 *
 * Two modes:
 *  - 'old_first'     (default): old pending bills consumed LIFO (newest-of-old first),
 *                               then any remainder applied to the new bill.
 *  - 'current_first': new bill consumed first, then old bills LIFO.
 *
 * LIFO = most-recent createdAt first (newest old bill paid before older ones).
 *
 * If the payment amount exceeds total pending across all bills, the excess is
 * reported as `excessAmount` and the applied amount is capped at total pending.
 * No credit balance is created — the caller decides what to do with the excess.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type UdhaarAllocationMode = 'old_first' | 'current_first';

/** Snapshot of a bill as seen by the allocator (read-only) */
export interface BillSnapshot {
  id: string;
  billNumber: string;
  pendingAmount: number;
  createdAt: Date;
}

/** How much of the payment was applied to one specific bill */
export interface AllocationEntry {
  billId: string;
  billNumber: string;
  amountApplied: number;     // always > 0
  pendingBefore: number;
  pendingAfter: number;      // pendingBefore - amountApplied
  newStatus: 'paid' | 'partial' | 'pending';
}

/** The complete allocation result */
export interface AllocationPlan {
  entries: AllocationEntry[];   // only bills that were actually touched (amountApplied > 0)
  totalApplied: number;
  excessAmount: number;         // > 0 means payment exceeded all pending; no allocation for excess
}

// ── Helper ────────────────────────────────────────────────────────────────────

function resolveStatus(pendingAfter: number): 'paid' | 'partial' | 'pending' {
  if (pendingAfter <= 0) return 'paid';
  return 'partial';
}

// ── Core Allocator ────────────────────────────────────────────────────────────

/**
 * Allocate a payment across a set of bills.
 *
 * @param oldBills      Previously-existing pending bills for the retailer.
 *                      Must NOT include the new bill being created.
 * @param newBill       The bill just created (or null if allocation is standalone).
 * @param paymentAmount The total amount the retailer is paying right now.
 * @param mode          'old_first' | 'current_first'
 */
export function allocateUdhaarPayment(
  oldBills: BillSnapshot[],
  newBill: BillSnapshot | null,
  paymentAmount: number,
  mode: UdhaarAllocationMode = 'old_first',
): AllocationPlan {
  if (paymentAmount <= 0) {
    return { entries: [], totalApplied: 0, excessAmount: 0 };
  }

  // Sort old bills LIFO (newest first)
  const sortedOld = [...oldBills].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Build the ordered queue depending on mode
  const queue: BillSnapshot[] = mode === 'old_first'
    ? [...sortedOld, ...(newBill ? [newBill] : [])]
    : [...(newBill ? [newBill] : []), ...sortedOld];

  const entries: AllocationEntry[] = [];
  let remaining = paymentAmount;

  for (const bill of queue) {
    if (remaining <= 0) break;
    if (bill.pendingAmount <= 0) continue; // already paid; skip

    const apply = Math.min(remaining, bill.pendingAmount);
    const pendingAfter = bill.pendingAmount - apply;

    entries.push({
      billId:       bill.id,
      billNumber:   bill.billNumber,
      amountApplied: apply,
      pendingBefore: bill.pendingAmount,
      pendingAfter:  Math.max(0, pendingAfter),
      newStatus:    resolveStatus(pendingAfter),
    });

    remaining -= apply;
  }

  const totalApplied = paymentAmount - remaining;
  const excessAmount = Math.max(0, remaining);

  return { entries, totalApplied, excessAmount };
}

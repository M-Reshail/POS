/**
 * Ledger Service
 *
 * Provides cross-retailer ledger queries and standalone payment recording.
 * The ledger is the financial backbone — every financial event creates an entry.
 *
 * Note: Bill-level payments are handled by bill.service.addPayment.
 * This service handles direct ledger payments (not tied to a specific bill).
 */

import { prisma } from '../../lib/prisma';
import { LedgerEntryType, LedgerPaymentMode, Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DirectPaymentInput {
  retailerId: string;
  amount: number;
  paymentMode: LedgerPaymentMode;
  notes?: string;
}

// ── Service Methods ───────────────────────────────────────────────────────────

/** Get the outstanding balance summary across all retailers (for admin overview) */
export const getLedgerSummary = async () => {
  const retailers = await prisma.retailer.findMany({
    select: {
      id: true,
      shopName: true,
      ownerName: true,
      ledgerEntries: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { balance: true },
      },
    },
    orderBy: { shopName: 'asc' },
  });

  return retailers.map((r) => {
    const outstanding = r.ledgerEntries[0] ? Number(r.ledgerEntries[0].balance) : 0;
    return {
      retailerId: r.id,
      shopName: r.shopName,
      ownerName: r.ownerName,
      outstanding,
    };
  });
};

/**
 * Record a direct payment against a retailer's outstanding balance.
 * Used for payments NOT tied to a specific bill (general ledger payments).
 * Creates a ledger entry of type 'payment'.
 */
export const recordDirectPayment = async (input: DirectPaymentInput) => {
  return prisma.$transaction(async (tx) => {
    const retailer = await tx.retailer.findUnique({ where: { id: input.retailerId } });
    if (!retailer) throw new Error('RETAILER_NOT_FOUND');

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { retailerId: input.retailerId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });

    const currentBalance = lastEntry ? Number(lastEntry.balance) : 0;
    if (input.amount > currentBalance) throw new Error('PAYMENT_EXCEEDS_BALANCE');

    const newBalance = currentBalance - input.amount;

    const entry = await tx.ledgerEntry.create({
      data: {
        retailerId: input.retailerId,
        entryType: LedgerEntryType.payment,
        amount: new Prisma.Decimal(input.amount),
        balance: new Prisma.Decimal(newBalance),
        paymentMode: input.paymentMode,
        notes: input.notes,
      },
      include: {
        retailer: { select: { shopName: true } },
      },
    });

    return { entry, previousBalance: currentBalance, newBalance };
  });
};

/** Get all ledger entries for a retailer with pagination */
export const getRetailerLedgerEntries = async (
  retailerId: string,
  limit = 50,
  offset = 0
) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) throw new Error('RETAILER_NOT_FOUND');

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { retailerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        bill: { select: { id: true, billNumber: true } },
      },
    }),
    prisma.ledgerEntry.count({ where: { retailerId } }),
  ]);

  const outstanding = entries[0] ? Number(entries[0].balance) : 0;

  return {
    retailer: {
      id: retailer.id,
      shopName: retailer.shopName,
    },
    outstanding,
    entries,
    pagination: { total, limit, offset },
  };
};

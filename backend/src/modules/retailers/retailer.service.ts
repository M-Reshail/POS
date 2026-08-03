/**
 * Retailers Service
 *
 * Manages retail shop accounts (credit customers).
 * Includes credit balance computation and RGB crate tracking.
 *
 * Business Rules enforced:
 *  - Credit limit alerts at 70% (orange), 90% (red), 100% (block)
 *  - RGB crate balance is tracked independently of monetary payments
 */

import { prisma } from '../../lib/prisma';
import { PriceTier, Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRetailerInput {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation?: string;
  creditLimit: number;
  priceTier?: PriceTier;
}

export interface UpdateRetailerInput extends Partial<CreateRetailerInput> {}


export type CreditStatus = 'ok' | 'warning' | 'alert' | 'blocked';

// ── Credit Status Helper ──────────────────────────────────────────────────────

const computeCreditStatus = (outstanding: number, creditLimit: number): CreditStatus => {
  if (creditLimit <= 0) return 'ok';
  const ratio = outstanding / creditLimit;
  if (ratio >= 1.0) return 'blocked';
  if (ratio >= 0.9) return 'alert';
  if (ratio >= 0.7) return 'warning';
  return 'ok';
};

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

/** List all retailers with outstanding balance and credit status */
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
        creditAvailable: Math.max(0, Number(r.creditLimit) - outstanding),
        creditStatus: computeCreditStatus(outstanding, Number(r.creditLimit)),
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
    creditAvailable: Math.max(0, Number(retailer.creditLimit) - outstanding),
    creditStatus: computeCreditStatus(outstanding, Number(retailer.creditLimit)),
  };
};

/** Create a new retailer */
export const createRetailer = async (input: CreateRetailerInput) => {
  return prisma.retailer.create({
    data: {
      ...input,
      creditLimit: new Prisma.Decimal(input.creditLimit),
    },
  });
};

/** Update retailer profile */
export const updateRetailer = async (id: string, input: UpdateRetailerInput) => {
  const exists = await prisma.retailer.findUnique({ where: { id } });
  if (!exists) throw new Error('RETAILER_NOT_FOUND');

  const data: Prisma.RetailerUpdateInput = { ...input };
  if (input.creditLimit !== undefined) {
    data.creditLimit = new Prisma.Decimal(input.creditLimit);
  }

  return prisma.retailer.update({ where: { id }, data });
};

/** Get paginated ledger entries for a retailer */
export const getRetailerLedger = async (
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
        bill: { select: { id: true, billNumber: true, total: true } },
      },
    }),
    prisma.ledgerEntry.count({ where: { retailerId } }),
  ]);

  const outstanding = entries[0] ? Number(entries[0].balance) : 0;

  return {
    retailer: {
      id: retailer.id,
      shopName: retailer.shopName,
      ownerName: retailer.ownerName,
      creditLimit: Number(retailer.creditLimit),
    },
    outstanding,
    creditStatus: computeCreditStatus(outstanding, Number(retailer.creditLimit)),
    entries,
    pagination: { total, limit, offset },
  };
};


/**
 * RGB Items Service
 *
 * Manages Returnable Glass Bottle (crate) stock via the new RGBItem model.
 * RGBItems are standalone — not linked to the Product catalog.
 *
 * Issue / return logic is deferred to Prompt 10. This service covers flat CRUD only.
 */

import { prisma } from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRGBItemInput {
  name: string;
  stockQuantity?: number;
}

export interface UpdateRGBItemInput {
  name?: string;
  stockQuantity?: number;
}

// ── Service Methods ───────────────────────────────────────────────────────────

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

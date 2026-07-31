/**
 * Products Service
 *
 * Business rules:
 *  - variant is ALWAYS stored lowercase (prevents case-variant duplicates)
 *  - brand identity is tracked via brandId FK (Brand model)
 *  - Soft-delete: isActive=false hides from all lists; hard-delete is disallowed
 *  - Duplicate guard: brandId + variant uniqueness at app level + DB level
 *  - GET endpoints (list, in-stock) always filter isActive: true and include brand
 *
 * Bug 2 fix: updateProduct ONLY allows editing variant, category, description.
 * The brand is NOT editable on a product — it is managed via PUT /api/brands/:id.
 * This prevents the "product appears in a new brand group" issue.
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  brandId: string;
  category: string;
  variant: string;
  description?: string;
}

export interface UpdateProductInput {
  // Brand is intentionally NOT here — brand changes go through PUT /api/brands/:id
  category?: string;
  variant?: string;
  description?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize variant/category to lowercase + trim */
const normalize = (s: string) => s.trim().toLowerCase();

/** Delete an image file from disk (silent — never throws) */
const deleteImageFile = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return;
  try {
    const filePath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    console.warn('[product.service] Could not delete old image:', imageUrl);
  }
};

// ── Brand include shape (reused on all GETs) ──────────────────────────────────

const brandInclude = {
  brandRel: {
    select: { id: true, name: true, displayName: true, imageUrl: true },
  },
} as const;

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * List all ACTIVE products with their current total stock and brand.
 */
export const getAllProducts = async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ brand: 'asc' }, { variant: 'asc' }],
    include: {
      ...brandInclude,
      stockBatches: {
        select: {
          id: true,
          quantity: true,
          salePrice: true,
          expiryDate: true,
          purchaseDate: true,
        },
        where: { quantity: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
      },
    },
  });

  return products.map((p) => ({
    ...p,
    // brand stays as the string from ...p
    // brandRel stays as the joined Brand object from ...p
    totalStock: p.stockBatches.reduce((sum, b) => sum + b.quantity, 0),
    currentSalePrice: p.stockBatches[0]?.salePrice ?? null,
  }));
};

/** Get a single product (active or not) with brand */
export const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      ...brandInclude,
      stockBatches: { orderBy: { purchaseDate: 'asc' } },
    },
  });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  return product;
};

/**
 * Products with available stock — ACTIVE only.
 * Used by the worker sales screen.
 */
export const getProductsInStock = async () => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stockBatches: { some: { quantity: { gt: 0 } } },
    },
    orderBy: [{ brand: 'asc' }, { variant: 'asc' }],
    include: {
      ...brandInclude,
      stockBatches: {
        where: { quantity: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
        select: { id: true, quantity: true, salePrice: true, expiryDate: true },
      },
    },
  });

  return products.map((p) => ({
    ...p,
    // brand stays as the string from ...p; brandRel is the joined Brand object
    totalStock: p.stockBatches.reduce((sum, b) => sum + b.quantity, 0),
    currentSalePrice: p.stockBatches[0]?.salePrice ?? null,
  }));
};

/**
 * Create a new product under an existing brand.
 * brandId must reference a valid Brand row.
 * Duplicate guard: no two active products can share the same brandId + variant.
 */
export const createProduct = async (input: CreateProductInput) => {
  const variant = normalize(input.variant);

  // Verify brand exists
  const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
  if (!brand) throw new Error('BRAND_NOT_FOUND');

  // Case-insensitive duplicate check (active products only)
  const existing = await prisma.product.findFirst({
    where: { brandId: input.brandId, variant, isActive: true },
  });
  if (existing) {
    throw new Error(
      `DUPLICATE_PRODUCT:A variant "${variant}" already exists under "${brand.displayName}". ` +
      `Did you mean to add stock instead?`
    );
  }

  return prisma.product.create({
    data: {
      brandId: input.brandId,
      brand:   brand.name,           // kept in sync for backward compat
      variant,
      category: normalize(input.category || 'general'),
      description: input.description,
    },
    include: brandInclude,
  });
};

/**
 * Update a product's editable fields: variant, category, description.
 * Brand is NOT editable here — use PUT /api/brands/:id to change brand image/name.
 * Bug 2 fix: brand is excluded from this method entirely.
 */
export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || !existing.isActive) throw new Error('PRODUCT_NOT_FOUND');

  const newVariant = input.variant ? normalize(input.variant) : existing.variant;

  // If variant changed, check for duplicates among other active products under same brand
  if (newVariant !== existing.variant && existing.brandId) {
    const conflict = await prisma.product.findFirst({
      where: {
        brandId: existing.brandId,
        variant: newVariant,
        isActive: true,
        NOT: { id },
      },
    });
    if (conflict) {
      throw new Error(
        `DUPLICATE_PRODUCT:A variant "${newVariant}" already exists under this brand.`
      );
    }
  }

  return prisma.product.update({
    where: { id },
    data: {
      variant:     newVariant,
      category:    input.category ? normalize(input.category) : undefined,
      description: input.description,
    },
    include: brandInclude,
  });
};

/**
 * Soft-delete a product (sets isActive = false).
 * Blocked if any StockBatch for this product has quantity > 0.
 */
export const softDeleteProduct = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.isActive) throw new Error('PRODUCT_NOT_FOUND');

  const stockBatches = await prisma.stockBatch.findMany({
    where: { productId: id, quantity: { gt: 0 } },
    select: { quantity: true },
  });

  const totalStock = stockBatches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalStock > 0) {
    throw new Error(`PRODUCT_HAS_STOCK:${totalStock}`);
  }

  return prisma.product.update({
    where: { id },
    data: { isActive: false },
  });
};

/**
 * Products Service
 *
 * Manages beverage product catalog.
 * Products are the master catalog — stock batches reference them.
 * Admin: full CRUD. Worker: read-only.
 */

import { prisma } from '../../lib/prisma';
import { ProductCategory, Prisma } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  brand: string;
  category: ProductCategory;
  variant: string;
  petConversionFactor: number;
  description?: string;
}

export interface UpdateProductInput {
  brand?: string;
  category?: ProductCategory;
  variant?: string;
  petConversionFactor?: number;
  description?: string;
}

// ── Service Methods ───────────────────────────────────────────────────────────

/** List all products with their current total stock (sum of all active batches) */
export const getAllProducts = async () => {
  const products = await prisma.product.findMany({
    orderBy: [{ brand: 'asc' }, { variant: 'asc' }],
    include: {
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

  // Enrich each product with computed stock summary
  return products.map((p) => ({
    ...p,
    totalStock: p.stockBatches.reduce((sum, b) => sum + b.quantity, 0),
    currentSalePrice: p.stockBatches[0]?.salePrice ?? null, // FIFO-first batch price
  }));
};

/** Get a single product with its stock batches */
export const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stockBatches: {
        orderBy: { purchaseDate: 'asc' },
      },
    },
  });

  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  return product;
};

/** Create a new product in the catalog */
export const createProduct = async (input: CreateProductInput) => {
  // Check for duplicate brand+variant combo
  const existing = await prisma.product.findFirst({
    where: {
      brand: { equals: input.brand, mode: Prisma.QueryMode.insensitive },
      variant: { equals: input.variant, mode: Prisma.QueryMode.insensitive },
    },
  });

  if (existing) throw new Error('PRODUCT_ALREADY_EXISTS');

  return prisma.product.create({ data: input });
};

/** Update product catalog information */
export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new Error('PRODUCT_NOT_FOUND');

  return prisma.product.update({ where: { id }, data: input });
};

/** Get products that have available stock (for worker sales screen) */
export const getProductsInStock = async () => {
  const products = await prisma.product.findMany({
    where: {
      stockBatches: {
        some: { quantity: { gt: 0 } },
      },
    },
    orderBy: [{ brand: 'asc' }, { variant: 'asc' }],
    include: {
      stockBatches: {
        where: { quantity: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
        select: {
          id: true,
          quantity: true,
          salePrice: true,
          expiryDate: true,
        },
      },
    },
  });

  return products.map((p) => ({
    ...p,
    totalStock: p.stockBatches.reduce((sum, b) => sum + b.quantity, 0),
    currentSalePrice: p.stockBatches[0]?.salePrice ?? null,
  }));
};

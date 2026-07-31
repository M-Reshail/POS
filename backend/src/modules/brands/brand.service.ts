/**
 * Brand Service
 *
 * Business logic for Brand CRUD.
 * Brands own the image — all products under a brand share its imageUrl.
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBrandInput {
  name: string;
  displayName?: string;
  imageUrl?: string;
}

export interface UpdateBrandInput {
  displayName?: string;
  imageUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.trim().toLowerCase();

const toTitleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const deleteImageFile = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return;
  try {
    // imageUrl is server-relative: /uploads/brands/abc.jpg
    const fp = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    console.warn('[brand.service] Could not delete old image:', imageUrl);
  }
};

// ── Service Methods ───────────────────────────────────────────────────────────

/** List all brands ordered by name */
export const getAllBrands = async () => {
  return prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
};

/** Get a single brand by id */
export const getBrandById = async (id: string) => {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new Error('BRAND_NOT_FOUND');
  return brand;
};

/**
 * Create a new brand.
 * name is normalized to lowercase. displayName defaults to title-case of name.
 */
export const createBrand = async (input: CreateBrandInput) => {
  const name = normalize(input.name);
  const displayName = input.displayName?.trim() || toTitleCase(name);

  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) throw new Error(`DUPLICATE_BRAND:A brand named "${name}" already exists.`);

  return prisma.brand.create({
    data: { name, displayName, imageUrl: input.imageUrl },
  });
};

/**
 * Update brand displayName and/or imageUrl.
 * Updating imageUrl here automatically propagates to all products (via JOIN).
 * The old image file is deleted from disk when replaced.
 */
export const updateBrand = async (id: string, input: UpdateBrandInput) => {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new Error('BRAND_NOT_FOUND');

  // Delete old image from disk if a new one is being set
  if (input.imageUrl && input.imageUrl !== brand.imageUrl) {
    deleteImageFile(brand.imageUrl);
  }

  return prisma.brand.update({
    where: { id },
    data: {
      displayName: input.displayName?.trim() || undefined,
      imageUrl: input.imageUrl,
    },
  });
};

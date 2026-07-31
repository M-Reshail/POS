/**
 * Brand Controller
 *
 * HTTP layer for brand endpoints.
 * Validates input, handles multipart image uploads, delegates to brand.service.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as brandService from './brand.service';
import {
  ok, created, badRequest, conflict, handleServiceError,
} from '../../lib/response';

// ── Multer setup ──────────────────────────────────────────────────────────────

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'brands');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  },
}).single('image');

// ── Validation Schemas ────────────────────────────────────────────────────────

const createBrandSchema = z.object({
  name:        z.string().min(1, 'Brand name is required.').trim(),
  displayName: z.string().trim().optional(),
});

const updateBrandSchema = z.object({
  displayName: z.string().trim().optional(),
});

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  BRAND_NOT_FOUND: { status: 404, message: 'Brand not found.' },
};

const parsePrefixedError = (error: unknown, res: Response): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.message.startsWith('DUPLICATE_BRAND:')) {
    conflict(res, error.message.slice('DUPLICATE_BRAND:'.length));
    return true;
  }
  return false;
};

// ── Shared upload runner ──────────────────────────────────────────────────────

const runUpload = (req: Request, res: Response): Promise<string | null> =>
  new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve(req.file ? `/uploads/brands/${req.file.filename}` : null);
    });
  });

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/brands — List all brands */
export const listBrands = async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await brandService.getAllBrands();
    ok(res, { brands });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/brands/:id — Single brand */
export const getBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = await brandService.getBrandById(req.params.id);
    ok(res, { brand });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** POST /api/brands — Create brand (multipart/form-data or JSON) */
export const createBrand = async (req: Request, res: Response): Promise<void> => {
  let imageUrl: string | null = null;
  if (req.is('multipart/form-data')) {
    try { imageUrl = await runUpload(req, res); }
    catch (err: any) { res.status(400).json({ success: false, message: err.message }); return; }
  }

  const parsed = createBrandSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }

  try {
    const brand = await brandService.createBrand({
      ...parsed.data,
      imageUrl: imageUrl ?? undefined,
    });
    created(res, { brand });
  } catch (error) {
    if (parsePrefixedError(error, res)) return;
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** PUT /api/brands/:id — Update brand displayName and/or image */
export const updateBrand = async (req: Request, res: Response): Promise<void> => {
  let newImageUrl: string | null = null;
  if (req.is('multipart/form-data')) {
    try { newImageUrl = await runUpload(req, res); }
    catch (err: any) { res.status(400).json({ success: false, message: err.message }); return; }
  }

  const parsed = updateBrandSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }

  try {
    const brand = await brandService.updateBrand(req.params.id, {
      ...parsed.data,
      ...(newImageUrl ? { imageUrl: newImageUrl } : {}),
    });
    ok(res, { brand });
  } catch (error) {
    if (parsePrefixedError(error, res)) return;
    handleServiceError(res, error, ERROR_MAP);
  }
};

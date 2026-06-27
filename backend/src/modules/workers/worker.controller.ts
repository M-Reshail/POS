/**
 * Workers Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as workerService from './worker.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';

// ── Validation ────────────────────────────────────────────────────────────────

const createWorkerSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  cnic: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  joinDate: z.string().optional(),
});

const updateWorkerSchema = z.object({
  name: z.string().min(2).trim().optional(),
  cnic: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  joinDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
});

const ERROR_MAP = {
  WORKER_NOT_FOUND: { status: 404, message: 'Worker not found.' },
  EMAIL_TAKEN: { status: 409, message: 'A user with this email already exists.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

export const listWorkers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const workers = await workerService.getAllWorkers();
    ok(res, { workers });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await workerService.getWorkerById(req.params.id);
    ok(res, { worker });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const createWorker = async (req: Request, res: Response): Promise<void> => {
  const parsed = createWorkerSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const worker = await workerService.createWorker(parsed.data);
    created(res, { worker });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const updateWorker = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateWorkerSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const worker = await workerService.updateWorker(req.params.id, parsed.data);
    ok(res, { worker });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const resetWorkerPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const result = await workerService.resetWorkerPassword(req.params.id, parsed.data.newPassword);
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

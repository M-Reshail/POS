/**
 * PaymentReminder Controller
 *
 * POST   /api/reminders        → createReminder
 * GET    /api/reminders        → listReminders  (?status=PENDING &retailerId=xxx)
 * GET    /api/reminders/due    → getDueReminders
 * PATCH  /api/reminders/:id   → updateReminder
 * DELETE /api/reminders/:id   → deleteReminder
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { ReminderStatus } from '@prisma/client';
import * as reminderService from './reminder.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';

// ── Validation Schemas ────────────────────────────────────────────────────────

const createReminderSchema = z.object({
  retailerId: z.string().min(1, 'retailerId is required.'),
  amount: z.number().positive('Amount must be greater than 0.'),
  dueDate: z.string().min(1, 'dueDate is required.'),
  note: z.string().trim().optional(),
});

const listRemindersSchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  retailerId: z.string().optional(),
});

const updateReminderSchema = z
  .object({
    amount: z.number().positive('Amount must be greater than 0.').optional(),
    dueDate: z.string().optional(),
    note: z.string().trim().optional(),
    status: z.nativeEnum(ReminderStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update.',
  });

// ── Error Map ─────────────────────────────────────────────────────────────────

const ERROR_MAP = {
  RETAILER_NOT_FOUND:  { status: 422, message: 'Retailer not found. Please provide a valid retailerId.' },
  DUE_DATE_IN_PAST:    { status: 400, message: 'dueDate cannot be in the past when creating a reminder.' },
  REMINDER_NOT_FOUND:  { status: 404, message: 'Payment reminder not found.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/reminders — Create a new payment reminder */
export const createReminder = async (req: Request, res: Response): Promise<void> => {
  const parsed = createReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const reminder = await reminderService.createReminder({
      ...parsed.data,
      createdById: req.user!.id,
    });
    created(res, { reminder });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/reminders — List all reminders, soonest first */
export const listReminders = async (req: Request, res: Response): Promise<void> => {
  const query = listRemindersSchema.safeParse(req.query);
  if (!query.success) {
    badRequest(res, 'Invalid query parameters.', query.error.flatten().fieldErrors);
    return;
  }
  try {
    const result = await reminderService.listReminders(query.data);
    ok(res, result);
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** GET /api/reminders/due — PENDING reminders where dueDate <= now (dashboard alerts) */
export const getDueReminders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await reminderService.getDueReminders();
    ok(res, result);
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** PATCH /api/reminders/:id — Update amount, date, note, or status */
export const updateReminder = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors);
    return;
  }
  try {
    const reminder = await reminderService.updateReminder(req.params.id, parsed.data);
    ok(res, { reminder });
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

/** DELETE /api/reminders/:id — Hard delete a reminder */
export const deleteReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await reminderService.deleteReminder(req.params.id);
    ok(res, result);
  } catch (error) {
    handleServiceError(res, error, ERROR_MAP);
  }
};

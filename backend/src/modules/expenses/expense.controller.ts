/**
 * Expenses Controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as expenseService from './expense.service';
import { ok, created, badRequest, handleServiceError } from '../../lib/response';
import { ExpenseCategory } from '@prisma/client';

// ── Validation ────────────────────────────────────────────────────────────────

const createExpenseSchema = z.object({
  title: z.string().min(2).trim(),
  amount: z.number().positive('Amount must be positive.'),
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().trim().optional(),
  date: z.string().optional(),
});

const listExpensesSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ERROR_MAP = {
  EXPENSE_NOT_FOUND: { status: 404, message: 'Expense not found.' },
};

// ── Controllers ───────────────────────────────────────────────────────────────

export const listExpenses = async (req: Request, res: Response): Promise<void> => {
  const query = listExpensesSchema.safeParse(req.query);
  if (!query.success) { badRequest(res, 'Invalid query parameters.'); return; }
  try {
    const result = await expenseService.getExpenses(query.data);
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, 'Validation failed.', parsed.error.flatten().fieldErrors); return; }
  try {
    const expense = await expenseService.createExpense({
      ...parsed.data,
      createdById: req.user!.id,
    });
    created(res, { expense });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await expenseService.deleteExpense(req.params.id);
    ok(res, result);
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

export const getExpenseSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await expenseService.getExpenseSummary();
    ok(res, { summary });
  } catch (error) { handleServiceError(res, error, ERROR_MAP); }
};

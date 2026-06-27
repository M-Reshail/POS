/**
 * Expenses Routes — Admin only
 *
 * GET    /api/expenses          → List expenses (with filters)
 * GET    /api/expenses/summary  → Period totals + category breakdown
 * POST   /api/expenses          → Create expense
 * DELETE /api/expenses/:id      → Delete expense
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { listExpenses, createExpense, deleteExpense, getExpenseSummary } from './expense.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/summary', getExpenseSummary);
router.get('/', listExpenses);
router.post('/', createExpense);
router.delete('/:id', deleteExpense);

export default router;

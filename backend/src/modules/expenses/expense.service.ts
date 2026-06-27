/**
 * Expenses Service
 * Daily business expense tracking with period summaries.
 */

import { prisma } from '../../lib/prisma';
import { ExpenseCategory, Prisma } from '@prisma/client';

// ── List expenses with optional filters ───────────────────────────────────────
export const getExpenses = async (options: {
  dateFrom?: string;
  dateTo?: string;
  category?: ExpenseCategory;
  limit?: number;
  offset?: number;
}) => {
  const where: Prisma.ExpenseWhereInput = {};

  if (options.dateFrom || options.dateTo) {
    where.date = {};
    if (options.dateFrom) (where.date as any).gte = new Date(options.dateFrom);
    if (options.dateTo) {
      const to = new Date(options.dateTo);
      to.setHours(23, 59, 59, 999);
      (where.date as any).lte = to;
    }
  }
  if (options.category) where.category = options.category;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total };
};

// ── Create expense ────────────────────────────────────────────────────────────
export const createExpense = async (data: {
  title: string;
  amount: number;
  category: ExpenseCategory;
  description?: string;
  date?: string;
  createdById: string;
}) => {
  return prisma.expense.create({
    data: {
      title: data.title,
      amount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date ? new Date(data.date) : new Date(),
      createdById: data.createdById,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });
};

// ── Delete expense ────────────────────────────────────────────────────────────
export const deleteExpense = async (id: string) => {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new Error('EXPENSE_NOT_FOUND');
  await prisma.expense.delete({ where: { id } });
  return { success: true };
};

// ── Summary: totals by period + category breakdown ────────────────────────────
export const getExpenseSummary = async () => {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTotal, weekTotal, monthTotal, categoryBreakdown] = await Promise.all([
    prisma.expense.aggregate({
      where: { date: { gte: startOfToday } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startOfWeek } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    today: Number(todayTotal._sum.amount ?? 0),
    week: Number(weekTotal._sum.amount ?? 0),
    month: Number(monthTotal._sum.amount ?? 0),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      total: Number(c._sum.amount ?? 0),
      count: c._count.id,
    })),
  };
};

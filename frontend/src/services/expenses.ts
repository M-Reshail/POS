import { api } from './api';
import { Expense, ExpenseCategory } from '../types';

export const expensesService = {
  getAll: async (params?: {
    dateFrom?: string;
    dateTo?: string;
    category?: ExpenseCategory;
  }): Promise<{ expenses: Expense[]; total: number }> => {
    const response: any = await api.get('/expenses', { params });
    return response.data;
  },
  getSummary: async (): Promise<{
    today: number;
    week: number;
    month: number;
    categoryBreakdown: { category: ExpenseCategory; total: number; count: number }[];
  }> => {
    const response: any = await api.get('/expenses/summary');
    return response.data.summary;
  },
  create: async (data: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    description?: string;
    date?: string;
  }): Promise<Expense> => {
    const response: any = await api.post('/expenses', data);
    return response.data.expense;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};

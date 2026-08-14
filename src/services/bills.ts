import { api } from './api';
import { Bill } from '../types';

export const billsService = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    retailerId?: string;
    status?: string;
  }): Promise<{ bills: Bill[]; total: number; limit: number; offset: number }> => {
    // Backend getBills returns: ok(res, { bills, total, limit, offset })
    // After interceptor: { success: true, data: { bills: [...], total, limit, offset } }
    const response: any = await api.get('/bills', { params });
    return response.data;
  },
  create: async (billData: any): Promise<any> => {
    // Backend createBill returns: created(res, result)
    // result is { bill, priceVariances } or { isRgbOnly: true, bill: null, ... }
    const response: any = await api.post('/bills', billData);
    return response.data.bill ?? response.data;
  },
  getById: async (id: string): Promise<Bill> => {
    const response: any = await api.get(`/bills/${id}`);
    return response.data.bill;
  },
  addPayment: async (id: string, paymentData: any): Promise<void> => {
    await api.post(`/bills/${id}/payment`, paymentData);
  },
  voidBill: async (id: string, reason: string): Promise<void> => {
    await api.post(`/bills/${id}/void`, { reason });
  }
};

import { api } from './api';
import { Bill } from '../types';

export const billsService = {
  list: async (): Promise<Bill[]> => {
    // Backend getBills returns: ok(res, { bills, total, limit, offset })
    // After interceptor: { success: true, data: { bills: [...], total, limit, offset } }
    const response: any = await api.get('/bills');
    return response.data.bills;
  },
  create: async (billData: any): Promise<Bill> => {
    // Backend createBill returns: created(res, result)
    // result is the full bill object from the transaction
    const response: any = await api.post('/bills', billData);
    return response.data.bill;
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

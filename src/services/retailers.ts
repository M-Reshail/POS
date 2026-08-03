import { api } from './api';
import { Retailer, LedgerEntry } from '../types';

export const retailersService = {
  getAll: async (): Promise<Retailer[]> => {
    // Backend: ok(res, { retailers }) → { success: true, data: { retailers: [...] } }
    const response: any = await api.get('/retailers');
    return response.data.retailers;
  },
  create: async (retailerData: Partial<Retailer>): Promise<Retailer> => {
    const response: any = await api.post('/retailers', retailerData);
    return response.data.retailer;
  },
  update: async (id: string, retailerData: Partial<Retailer>): Promise<Retailer> => {
    const response: any = await api.put(`/retailers/${id}`, retailerData);
    return response.data.retailer;
  },
  getLedger: async (id: string): Promise<LedgerEntry[]> => {
    // Backend: ok(res, ledger) where ledger = { entries, total, ... }
    const response: any = await api.get(`/retailers/${id}/ledger`);
    return response.data;
  },
};


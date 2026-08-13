import { api } from './api';
import { Retailer, LedgerEntry } from '../types';

export const retailersService = {
  getAll: async (): Promise<Retailer[]> => {
    // Backend: ok(res, { retailers }) → { success: true, data: { retailers: [...] } }
    const response: any = await api.get('/retailers');
    return response.data.retailers;
  },
  getById: async (id: string): Promise<Retailer> => {
    const response: any = await api.get(`/retailers/${id}`);
    return response.data.retailer;
  },
  create: async (retailerData: Partial<Retailer>): Promise<Retailer> => {
    const response: any = await api.post('/retailers', retailerData);
    return response.data.retailer;
  },
  update: async (id: string, retailerData: Partial<Retailer>): Promise<Retailer> => {
    const response: any = await api.put(`/retailers/${id}`, retailerData);
    return response.data.retailer;
  },
  getLedger: async (
    id: string,
    limit = 15,
    offset = 0
  ): Promise<{
    retailer: { id: string; shopName: string; ownerName: string };
    outstanding: number;
    entries: LedgerEntry[];
    pagination: { total: number; limit: number; offset: number };
  }> => {
    const response: any = await api.get(`/retailers/${id}/ledger`, {
      params: { limit, offset },
    });
    return response.data;
  },
};


import { api } from './api';
import { RGBItem, RGBRetailerBalance, RGBTransactionRecord } from '../types';

export const rgbService = {
  /** Get all RGB items */
  getAll: async (): Promise<RGBItem[]> => {
    const response: any = await api.get('/rgb');
    return response.data.items;
  },

  /** Get all RGB transaction logs */
  getTransactions: async (params?: {
    retailerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: RGBTransactionRecord[]; total: number; limit?: number; offset?: number }> => {
    const response: any = await api.get('/rgb/transactions', { params: { limit: 2000, ...params } });
    return response.data;
  },

  /** Create a new RGB item (name + starting stockQuantity only) */
  create: async (data: {
    name: string;
    stockQuantity?: number;
  }): Promise<RGBItem> => {
    const response: any = await api.post('/rgb', data);
    return response.data.item;
  },

  /** Update an RGB item (name and/or stockQuantity) */
  update: async (
    id: string,
    data: { name?: string; stockQuantity?: number }
  ): Promise<RGBItem> => {
    const response: any = await api.put(`/rgb/${id}`, data);
    return response.data.item;
  },

  /** Delete an RGB item */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/rgb/${id}`);
  },

  /** Get per-item RGB crate balances for a specific retailer */
  getRetailerBalances: async (retailerId: string): Promise<RGBRetailerBalance[]> => {
    const response: any = await api.get(`/rgb/retailer/${retailerId}`);
    return response.data.balances;
  },

  /** Standalone crate return (outside a sale — e.g. driver collects crates) */
  returnStandalone: async (
    rgbItemId: string,
    body: { retailerId: string; quantity: number }
  ): Promise<void> => {
    await api.post(`/rgb/${rgbItemId}/return`, body);
  },
};

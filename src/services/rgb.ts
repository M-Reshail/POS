import { api } from './api';
import { RGBVariety } from '../types';

export const rgbService = {
  /** Get all RGB varieties */
  getAll: async (): Promise<RGBVariety[]> => {
    const response: any = await api.get('/rgb');
    return response.data.varieties;
  },

  /** Create a new RGB variety */
  create: async (data: {
    name: string;
    linkedProductId?: string;
    stockQuantity?: number;
  }): Promise<RGBVariety> => {
    const response: any = await api.post('/rgb', data);
    return response.data.variety;
  },

  /** Adjust stock by a delta (+/-) */
  adjustStock: async (id: string, adjustment: number): Promise<RGBVariety> => {
    const response: any = await api.put(`/rgb/${id}/adjust`, { adjustment });
    return response.data.variety;
  },

  /** Set absolute stock quantity */
  setStock: async (id: string, stockQuantity: number): Promise<RGBVariety> => {
    const response: any = await api.put(`/rgb/${id}`, { stockQuantity });
    return response.data.variety;
  },

  /** Delete an RGB variety */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/rgb/${id}`);
  },
};

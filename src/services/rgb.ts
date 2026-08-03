import { api } from './api';
import { RGBItem } from '../types';

export const rgbService = {
  /** Get all RGB items */
  getAll: async (): Promise<RGBItem[]> => {
    const response: any = await api.get('/rgb');
    return response.data.items;
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
};


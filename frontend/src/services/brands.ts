import { api } from './api';
import { Brand } from '../types';

export const brandsService = {
  /** GET /api/brands — list all brands */
  list: async (): Promise<Brand[]> => {
    const res: any = await api.get('/brands');
    return res.data.brands;
  },

  /** POST /api/brands — create brand (multipart: name + displayName + image file) */
  create: async (name: string, displayName: string, imageFile?: File): Promise<Brand> => {
    const form = new FormData();
    form.append('name', name);
    form.append('displayName', displayName);
    if (imageFile) form.append('image', imageFile);
    const res: any = await api.post('/brands', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.brand;
  },

  /** PUT /api/brands/:id — update brand (multipart: displayName? + image file?) */
  update: async (id: string, displayName?: string, imageFile?: File): Promise<Brand> => {
    const form = new FormData();
    if (displayName) form.append('displayName', displayName);
    if (imageFile)   form.append('image', imageFile);
    const res: any = await api.put(`/brands/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.brand;
  },
};

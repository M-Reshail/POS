import { api } from './api';
import { Worker } from '../types';

export const workersService = {
  getAll: async (): Promise<Worker[]> => {
    const response: any = await api.get('/workers');
    return response.data.workers;
  },
  getById: async (id: string): Promise<Worker> => {
    const response: any = await api.get(`/workers/${id}`);
    return response.data.worker;
  },
  create: async (data: {
    name: string;
    email: string;
    password: string;
    cnic?: string;
    phone?: string;
    joinDate?: string;
  }): Promise<Worker> => {
    const response: any = await api.post('/workers', data);
    return response.data.worker;
  },
  update: async (id: string, data: Partial<Worker> & { isActive?: boolean }): Promise<Worker> => {
    const response: any = await api.patch(`/workers/${id}`, data);
    return response.data.worker;
  },
  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    await api.post(`/workers/${id}/reset-password`, { newPassword });
  },
};

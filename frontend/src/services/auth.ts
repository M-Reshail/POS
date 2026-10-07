import { api } from './api';
import { User } from '../types';

export const authService = {
  login: async (username: string, password: string): Promise<{ accessToken: string; user: User }> => {
    // Backend returns: { success: true, data: { accessToken, user } }
    const response: any = await api.post('/auth/login', { username, password });
    return response.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
  getCurrentUser: async (): Promise<{ user: User }> => {
    // Backend returns: { success: true, data: { user } }
    const response: any = await api.get('/auth/me');
    return response.data;
  }
};

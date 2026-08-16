import { api } from './api';
import { PaymentReminder, ReminderStatus } from '../types';

export interface CreateReminderInput {
  retailerId: string;
  amount: number;
  dueDate: string;
  note?: string;
}

export interface UpdateReminderInput {
  amount?: number;
  dueDate?: string;
  note?: string;
  status?: ReminderStatus;
}

export const remindersService = {
  getDueReminders: async (): Promise<{ reminders: PaymentReminder[]; total: number }> => {
    const response: any = await api.get('/reminders/due');
    return response.data;
  },

  getAllReminders: async (params?: {
    status?: ReminderStatus;
    retailerId?: string;
  }): Promise<{ reminders: PaymentReminder[]; total: number }> => {
    const response: any = await api.get('/reminders', { params });
    return response.data;
  },

  createReminder: async (data: CreateReminderInput): Promise<PaymentReminder> => {
    const response: any = await api.post('/reminders', data);
    return response.data.reminder;
  },

  updateReminder: async (id: string, data: UpdateReminderInput): Promise<PaymentReminder> => {
    const response: any = await api.patch(`/reminders/${id}`, data);
    return response.data.reminder;
  },

  deleteReminder: async (id: string): Promise<void> => {
    await api.delete(`/reminders/${id}`);
  },
};

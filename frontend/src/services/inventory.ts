import { api } from './api';
import { StockBatch, StockAdjustment } from '../types';

export const inventoryService = {
  getBatches: async (): Promise<StockBatch[]> => {
    // Backend: ok(res, { batches }) → { success: true, data: { batches: [...] } }
    const response: any = await api.get('/inventory');
    return response.data.batches;
  },
  addBatch: async (batchData: Partial<StockBatch>): Promise<StockBatch> => {
    // Backend route: POST /api/inventory (not /api/inventory/batch)
    const response: any = await api.post('/inventory', batchData);
    return response.data.batch;
  },
  adjustStock: async (batchId: string, adjustmentData: { quantity: number; reason: string; notes: string }): Promise<{ adjustment: StockAdjustment; batch: StockBatch }> => {
    // Backend route: POST /api/inventory/:id/adjust
    const response: any = await api.post(`/inventory/${batchId}/adjust`, adjustmentData);
    return response.data;
  },
  getLowStock: async (): Promise<any> => {
    const response: any = await api.get('/inventory/low-stock');
    return response.data;
  },
  getExpiryRisk: async (): Promise<any> => {
    const response: any = await api.get('/inventory/expiry-risk');
    return response.data;
  }
};

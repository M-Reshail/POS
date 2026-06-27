import { api } from './api';
import { Product } from '../types';

export const productsService = {
  getAll: async (): Promise<Product[]> => {
    // Backend: ok(res, { products }) → { success: true, data: { products: [...] } }
    // After interceptor: { success: true, data: { products: [...] } }
    const response: any = await api.get('/products');
    return response.data.products;
  },
  getInStock: async (): Promise<Product[]> => {
    const response: any = await api.get('/products/in-stock');
    return response.data.products;
  },
  create: async (productData: Partial<Product>): Promise<Product> => {
    const response: any = await api.post('/products', productData);
    return response.data.product;
  },
  update: async (id: string, productData: Partial<Product>): Promise<Product> => {
    const response: any = await api.put(`/products/${id}`, productData);
    return response.data.product;
  }
};

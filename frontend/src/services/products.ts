import { api } from './api';
import { Product } from '../types';

export const productsService = {
  getAll: async (): Promise<Product[]> => {
    const response: any = await api.get('/products');
    return response.data.products;
  },

  getInStock: async (): Promise<Product[]> => {
    const response: any = await api.get('/products/in-stock');
    return response.data.products;
  },

  /**
   * Create a new product variant under an existing brand.
   * Brand must already exist — pass brandId (UUID).
   * No image field — images are managed at brand level.
   */
  create: async (data: {
    brandId: string;
    variant: string;
    category?: string;
    description?: string;
  }): Promise<Product> => {
    const response: any = await api.post('/products', {
      category: 'general',
      ...data,
    });
    return response.data.product;
  },

  /**
   * Update product editable fields: variant, category, description.
   * Brand is intentionally excluded — change brand image via brandsService.update().
   */
  update: async (
    id: string,
    data: { variant?: string; category?: string; description?: string }
  ): Promise<Product> => {
    const response: any = await api.put(`/products/${id}`, data);
    return response.data.product;
  },

  /** Soft-delete a product. Returns 409 if stock > 0. */
  softDelete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },

  /** Returns the full URL for a server-relative image path. */
  getImageUrl: (imageUrl?: string | null): string | null => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
    return `${base}${imageUrl}`;
  },
};

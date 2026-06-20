import { create } from 'zustand';
import { User, Retailer, Bill, StockBatch, Product } from '../types';

interface Store {
  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  // Retailers
  retailers: Retailer[];
  setRetailers: (retailers: Retailer[]) => void;
  addRetailer: (retailer: Retailer) => void;
  
  // Products
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  
  // Stock
  stockBatches: StockBatch[];
  setStockBatches: (batches: StockBatch[]) => void;
  addStockBatch: (batch: StockBatch) => void;
  
  // Bills
  bills: Bill[];
  setBills: (bills: Bill[]) => void;
  addBill: (bill: Bill) => void;
  
  // Current Bill (for building)
  currentBill: Partial<Bill> | null;
  setCurrentBill: (bill: Partial<Bill> | null) => void;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
}

export const useStore = create<Store>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  retailers: [],
  setRetailers: (retailers) => set({ retailers }),
  addRetailer: (retailer) => set((state) => ({ 
    retailers: [...state.retailers, retailer] 
  })),
  
  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ 
    products: [...state.products, product] 
  })),
  
  stockBatches: [],
  setStockBatches: (batches) => set({ stockBatches: batches }),
  addStockBatch: (batch) => set((state) => ({ 
    stockBatches: [...state.stockBatches, batch] 
  })),
  
  bills: [],
  setBills: (bills) => set({ bills }),
  addBill: (bill) => set((state) => ({ 
    bills: [...state.bills, bill] 
  })),
  
  currentBill: null,
  setCurrentBill: (bill) => set({ currentBill: bill }),
  
  notifications: [],
  addNotification: (type, message) => set((state) => ({
    notifications: [...state.notifications, {
      id: Date.now().toString(),
      type,
      message,
    }]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
}));

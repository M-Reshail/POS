import { create } from 'zustand';
import { User, Retailer, Bill, StockBatch, Product, Worker, Expense, ExpenseCategory, RGBItem } from '../types';
import { authService } from '../services/auth';
import { productsService } from '../services/products';
import { retailersService } from '../services/retailers';
import { inventoryService } from '../services/inventory';
import { billsService } from '../services/bills';
import { workersService } from '../services/workers';
import { expensesService } from '../services/expenses';
import { rgbService } from '../services/rgb';

interface Store {
  // Global State
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  fetchCurrentUser: () => Promise<void>;

  // Retailers
  retailers: Retailer[];
  fetchRetailers: () => Promise<void>;

  // Products
  products: Product[];
  fetchProducts: () => Promise<void>;

  // Stock
  stockBatches: StockBatch[];
  fetchInventory: () => Promise<void>;

  // Bills
  bills: Bill[];
  fetchBills: () => Promise<void>;

  // Workers
  workers: Worker[];
  fetchWorkers: () => Promise<void>;

  // RGB Items (DB-backed crate stock)
  rgbItems: RGBItem[];
  fetchRGBItems: () => Promise<void>;

  // Expenses
  expenses: Expense[];
  expenseSummary: { today: number; week: number; month: number; categoryBreakdown: any[] } | null;
  fetchExpenses: (params?: { dateFrom?: string; dateTo?: string; category?: ExpenseCategory }) => Promise<void>;
  fetchExpenseSummary: () => Promise<void>;

  // Current Bill (for building)
  currentBill: Partial<Bill> | null;
  setCurrentBill: (bill: Partial<Bill> | null) => void;
  checkoutBill: (billData: any) => Promise<void>;

  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // Initializer
  fetchInitialData: () => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  isLoading: false,
  error: null,
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  fetchCurrentUser: async () => {
    try {
      const { user } = await authService.getCurrentUser();
      set({ currentUser: user });
    } catch (err) {
      set({ currentUser: null });
    }
  },

  retailers: [],
  fetchRetailers: async () => {
    try {
      const data = await retailersService.getAll();
      set({ retailers: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load retailers');
    }
  },

  products: [],
  fetchProducts: async () => {
    try {
      const data = await productsService.getAll();
      set({ products: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load products');
    }
  },

  stockBatches: [],
  fetchInventory: async () => {
    try {
      const data = await inventoryService.getBatches();
      set({ stockBatches: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load inventory');
    }
  },

  bills: [],
  fetchBills: async () => {
    try {
      const data = await billsService.list();
      set({ bills: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load bills');
    }
  },

  workers: [],
  fetchWorkers: async () => {
    try {
      const data = await workersService.getAll();
      set({ workers: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load workers');
    }
  },

  rgbItems: [],
  fetchRGBItems: async () => {
    try {
      const data = await rgbService.getAll();
      set({ rgbItems: data });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load RGB items');
    }
  },

  expenses: [],
  expenseSummary: null,
  fetchExpenses: async (params) => {
    try {
      const { expenses } = await expensesService.getAll(params);
      set({ expenses });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load expenses');
    }
  },
  fetchExpenseSummary: async () => {
    try {
      const summary = await expensesService.getSummary();
      set({ expenseSummary: summary });
    } catch (err: any) {
      get().addNotification('error', 'Failed to load expense summary');
    }
  },

  currentBill: null,
  setCurrentBill: (bill) => set({ currentBill: bill }),

  checkoutBill: async (billData) => {
    try {
      set({ isLoading: true, error: null });
      const response: any = await billsService.create(billData);

      if (response && response.isRgbOnly) {
        set({ currentBill: null, isLoading: false });
        get().addNotification('success', 'RGB crate exchange recorded successfully');
      } else {
        // Optimistic update for regular bills
        set((state) => ({
          bills: response?.id ? [...state.bills, response] : state.bills,
          currentBill: null,
          isLoading: false,
        }));
        get().addNotification('success', 'Bill created successfully');
      }

      // Re-fetch updated data (inventory, retailers, RGB stock, and bills)
      get().fetchInventory();
      get().fetchRetailers();
      get().fetchRGBItems();
      get().fetchBills();
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message || 'Failed to process request', isLoading: false });
      get().addNotification('error', err.response?.data?.message || 'Failed to process request');
      throw err;
    }
  },

  notifications: [],
  addNotification: (type, message) =>
    // REPLACE — not append. Only one toast ever exists at a time.
    // Rapid clicks (e.g. RGB +/−) will instantly replace the previous toast
    // instead of stacking. The id change causes the Notifications component
    // to restart its auto-dismiss timer cleanly.
    set({ notifications: [{ id: Date.now().toString(), type, message }] }),
  removeNotification: (_id) =>
    set({ notifications: [] }),

  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [retailers, products, stockBatches, bills, rgbItems] = await Promise.all([
        retailersService.getAll(),
        productsService.getAll(),
        inventoryService.getBatches(),
        billsService.list(),
        rgbService.getAll(),
      ]);
      set({ retailers, products, stockBatches, bills, rgbItems, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load initial data', isLoading: false });
      get().addNotification('error', 'Failed to synchronize with server');
    }
  },
}));

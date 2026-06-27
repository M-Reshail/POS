// User Types
export type UserRole = 'admin' | 'worker';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  cnic?: string;
  phone?: string;
  joinDate?: Date | string;
  createdAt: Date;
}

// Worker (extends User with sales stats)
export interface Worker extends User {
  totalBills: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  billsCreated?: any[];
}

// Expense Types
export type ExpenseCategory = 'fuel' | 'salary' | 'delivery' | 'electricity' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  description?: string;
  date: Date | string;
  createdById: string;
  createdBy?: { id: string; name: string; role: string };
  createdAt: Date;
}

// Product Types
export interface Product {
  id: string;
  brand: string;
  category: 'soft-drink' | 'juice' | 'water' | 'energy-drink';
  variant: string;
  petConversionFactor: number;
  description?: string;
}

// Stock Types
export interface StockBatch {
  id: string;
  productId: string;
  quantity: number; // in PET units
  buyPrice: number;
  salePrice: number;
  batchNumber: string;
  expiryDate: Date | string;
  purchaseDate: Date | string;
  supplierId?: string;
  supplier?: string;
  createdAt: Date;
  product?: Product;
}

export interface StockAdjustment {
  id: string;
  batchId: string;
  quantity: number;
  reason: 'damage' | 'theft' | 'manual-correction';
  notes: string;
  adminId: string;
  createdAt: Date;
}

// Retailer Types
export interface Retailer {
  id: string;
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation?: string;
  creditLimit: number;
  priceTier: 'standard' | 'premium' | 'discount';
  createdAt: Date;
}

// Ledger Types
export interface LedgerEntry {
  id: string;
  retailerId: string;
  billId?: string;
  entryType: 'sale' | 'payment' | 'return' | 'adjustment';
  amount: number;
  balance: number;
  paymentMode?: 'cash' | 'bank-transfer' | 'check';
  notes?: string;
  createdAt: Date;
}

// Bill Types
export interface BillItem {
  id: string;
  productId: string;
  quantity: number; // in PET
  price: number;
  discount?: number;
  total: number;
  product?: { brand: string; variant: string };
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: Date;
  paymentMode: 'cash' | 'credit' | 'udhar' | 'generate-only';
  notes?: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  retailerId: string;
  workerId: string;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  paymentMode?: 'cash' | 'credit' | 'udhar' | 'generate-only';
  previousPendingAdded?: number;
  oldPendingPaymentApplied?: number;
  paymentHistory: PaymentRecord[];
  status: 'pending' | 'paid' | 'partial';
  retailer?: { id: string; shopName: string; ownerName: string; mobileNumber?: string };
  worker?: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

// RGB Tracking
export interface RGBTracking {
  id: string;
  retailerId: string;
  issuedQuantity: number;
  returnedQuantity: number;
  balance: number;
  lastUpdated: Date;
}

// Price History
export interface PriceHistory {
  id: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  date: Date;
}

// Voided Bill Log
export interface VoidedBillLog {
  id: string;
  billId: string;
  workerId: string;
  voidedAt: Date;
  billValue: number;
  reason: string;
}

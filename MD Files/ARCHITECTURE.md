# System Architecture & Implementation Guide

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema (Implemented via Prisma)](#database-schema-implemented-via-prisma)
4. [API Endpoints](#api-endpoints)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Authentication Flow](#authentication-flow)
8. [Business Logic Enforced Server-side](#business-logic-enforced-server-side)
9. [Security Measures](#security-measures)

---

## System Overview

### High-Level Architecture

The system follows a full-stack client-server architecture with state management on the client and database persistence on the backend.

```
┌─────────────────────────────────────────────────────────────┐
│                    Beverage POS System                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        React Frontend (Vite + TypeScript)             │   │
│  ├───────────────────┬────────────────────────────────┤   │
│  │  Admin Module     │      Worker Module              │   │
│  │  - Dashboard      │  - Sales Billing               │   │
│  │  - Inventory      │  - Cart Management             │   │
│  │  - Retailers      │  - Price Override              │   │
│  │  - Reports        │  - Print Preview               │   │
│  └───────────────────┴────────────────────────────────┘   │
│                         │                                   │
│                    Zustand Store                            │
│           (API Client Services integration)                 │
│                         │                                   │
│                         │ HTTP REST APIs                    │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│         TypeScript Node.js / Express Backend                │
│  - JWT Auth (Access/Refresh Tokens via httpOnly Cookie)     │
│  - Business Logic Verification (FIFO, Credit, Price Variance) │
│  - Controllers, Services, & Routes structure                │
│                         │                                   │
│                    Prisma ORM                               │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│                 PostgreSQL Database                         │
│  - Relational Schema mapping 13 models                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

| Layer      | Technology   | Version | Purpose                |
| ---------- | ------------ | ------- | ---------------------- |
| Framework  | React        | 18.2.0  | UI Components & State  |
| Language   | TypeScript   | 5.3.2   | Type Safety            |
| Build Tool | Vite         | 5.0.7   | Fast Development/Build |
| Styling    | Tailwind CSS | 3.3.6   | Utility-First CSS      |
| State Mgmt | Zustand      | 4.4.2   | Global State Store     |
| Routing    | React Router | 6.20.0  | Client-Side Navigation |
| Icons      | Lucide React | 0.344.0 | SVG Icons              |
| Date Utils | date-fns     | 2.30.0  | Date Manipulation      |

### Backend

| Layer       | Technology   | Version | Purpose                      |
| ----------- | ------------ | ------- | ---------------------------- |
| Runtime     | Node.js      | 18+     | JavaScript Execution Runtime |
| Framework   | Express      | 4.18.2  | REST API Router & Handlers   |
| Language    | TypeScript   | 5.3.2   | Type Safety                  |
| Database    | PostgreSQL   | 15+     | Relational Database          |
| ORM         | Prisma       | 5.7.0   | Database client & migrations |
| Validation  | Zod          | 3.22.4  | Schema & Env validation      |
| Cryptography| bcrypt       | 5.1.1   | Password hashing             |
| Tokens      | JSONWebToken | 9.0.2   | Stateless authentication     |

---

## Database Schema (Implemented via Prisma)

The database schema is defined in `backend/prisma/schema.prisma` and uses PostgreSQL. The model names and field mappings are defined below:

### Enums
- **`UserRole`**: `admin`, `worker`
- **`ProductCategory`**: `soft_drink`, `juice`, `water`, `energy_drink`
- **`AdjustmentReason`**: `damage`, `theft`, `manual_correction`
- **`PriceTier`**: `standard`, `premium`, `discount`
- **`LedgerEntryType`**: `sale`, `payment`, `return`, `adjustment`
- **`LedgerPaymentMode`**: `cash`, `bank_transfer`, `check`
- **`BillPaymentMode`**: `cash`, `credit`, `udhar`, `generate_only`
- **`BillStatus`**: `pending`, `paid`, `partial`

### Users (`users`)
Represents an individual with access to the system.
- `id` (String/UUID, PK)
- `name` (String)
- `email` (String, Unique)
- `passwordHash` (String)
- `role` (UserRole)
- `isActive` (Boolean, default `true`)
- `createdAt` (DateTime, default `now()`)

### Products (`products`)
Represents a sellable beverage brand/variant catalog.
- `id` (String/UUID, PK)
- `brand` (String) - e.g., 'Pepsi', 'Sprite'
- `category` (ProductCategory)
- `variant` (String) - e.g., '1.5L', 'Can'
- `petConversionFactor` (Int) - Multiplier to convert Variant to Bottle Equivalents (PET)
- `description` (String, Nullable)

### Stock Batches (`stock_batches`)
Represents a specific shipment of a Product received into inventory. FIFO queue is resolved across these batches.
- `id` (String/UUID, PK)
- `productId` (String/UUID, FK -> `Product.id`)
- `quantity` (Int) - Remaining inventory count in PET units
- `buyPrice` (Decimal, 10,2) - Wholesale purchase cost per PET unit
- `salePrice` (Decimal, 10,2) - Retail price per PET unit
- `batchNumber` (String, Unique) - Identifier from manufacturer
- `expiryDate` (DateTime) - Expiry date
- `purchaseDate` (DateTime) - Purchase date
- `supplierId` (String, Nullable)
- `supplier` (String, Nullable)
- `createdAt` (DateTime, default `now()`)

### Stock Adjustments (`stock_adjustments`)
Logs manual adjustments made to a specific StockBatch (shrinkage audit trail).
- `id` (String/UUID, PK)
- `batchId` (String/UUID, FK -> `StockBatch.id`)
- `quantity` (Int) - Positive for additions, negative for deductions
- `reason` (AdjustmentReason)
- `notes` (String)
- `adminId` (String/UUID, FK -> `User.id` - Admin responsible)
- `createdAt` (DateTime, default `now()`)

### Retailers (`retailers`)
Represents a customer/shop interacting with the wholesale business.
- `id` (String/UUID, PK)
- `shopName` (String)
- `ownerName` (String)
- `mobileNumber` (String)
- `address` (String)
- `deliveryLocation` (String, Nullable)
- `creditLimit` (Decimal, 12,2) - Ceiling for pending debts
- `priceTier` (PriceTier, default `standard`)
- `createdAt` (DateTime, default `now()`)

### Ledger Entries (`ledger_entries`)
Records transactions affecting a Retailer's credit balance.
- `id` (String/UUID, PK)
- `retailerId` (String/UUID, FK -> `Retailer.id`)
- `billId` (String/UUID, FK -> `Bill.id`, Nullable)
- `entryType` (LedgerEntryType)
- `amount` (Decimal, 12,2) - Amount added/subtracted
- `balance` (Decimal, 12,2) - Retailer's running outstanding balance *after* transaction
- `paymentMode` (LedgerPaymentMode, Nullable)
- `notes` (String, Nullable)
- `createdAt` (DateTime, default `now()`)

### RGB Tracking (`rgb_tracking`)
Tracks the issue and return of Returnable Glass Bottles (crates) independently of cash balance.
- `id` (String/UUID, PK)
- `retailerId` (String/UUID, FK -> `Retailer.id`, Unique)
- `issuedQuantity` (Int, default `0`)
- `returnedQuantity` (Int, default `0`)
- `balance` (Int, default `0`) - `issuedQuantity - returnedQuantity`
- `lastUpdated` (DateTime, updated automatic)

### Bills (`bills`)
Represents a finalized sales invoice.
- `id` (String/UUID, PK)
- `billNumber` (String, Unique) - Human readable code
- `retailerId` (String/UUID, FK -> `Retailer.id`)
- `workerId` (String/UUID, FK -> `User.id`) - Worker who generated bill
- `subtotal` (Decimal, 12,2)
- `discount` (Decimal, default `0`)
- `total` (Decimal, 12,2)
- `paidAmount` (Decimal, default `0`)
- `pendingAmount` (Decimal, 12,2) - Added to outstanding balance
- `paymentMode` (BillPaymentMode, Nullable)
- `previousPendingAdded` (Decimal, Nullable) - Outstanding balance injected on printed bill
- `oldPendingPaymentApplied` (Decimal, Nullable) - Payment applied to historical balance during checkout
- `status` (BillStatus)
- `createdAt` (DateTime, default `now()`)
- `updatedAt` (DateTime, updated automatic)

### Bill Items (`bill_items`)
Line items nested inside a Bill.
- `id` (String/UUID, PK)
- `billId` (String/UUID, FK -> `Bill.id` on delete Cascade)
- `productId` (String/UUID, FK -> `Product.id`)
- `quantity` (Int) - Count of PET units purchased
- `price` (Decimal, 10,2) - Price sold at
- `discount` (Decimal, default `0`)
- `total` (Decimal, 12,2) - `(quantity * price) - discount`

### Payment Records (`payment_records`)
Logs historical partial payments applied directly against a specific Bill.
- `id` (String/UUID, PK)
- `billId` (String/UUID, FK -> `Bill.id` on delete Cascade)
- `amount` (Decimal, 12,2)
- `date` (DateTime, default `now()`)
- `paymentMode` (BillPaymentMode)
- `notes` (String, Nullable)

### Price History (`price_history`)
Logs when an Admin alters a Product variant's baseline selling configuration.
- `id` (String/UUID, PK)
- `productId` (String/UUID, FK -> `Product.id`)
- `oldPrice` (Decimal, 10,2)
- `newPrice` (Decimal, 10,2)
- `changedBy` (String/UUID, FK -> `User.id` - Admin responsible)
- `date` (DateTime, default `now()`)

### Voided Bill Logs (`voided_bill_logs`)
Maintains an audit trail of soft-deleted invoices.
- `id` (String/UUID, PK)
- `billId` (String/UUID, FK -> `Bill.id`, Unique)
- `workerId` (String/UUID, FK -> `User.id` - Worker who processed it originally)
- `voidedAt` (DateTime, default `now()`)
- `billValue` (Decimal, 12,2)
- `reason` (String) - Explanation required from Admin

---

## API Endpoints

All backend routes are protected under RBAC middleware (with `/api` prefix).

### Authentication (`/api/auth`)
- `POST /login` - Single login endpoint for Admin and Worker. Decodes credentials and sets short-lived Access Token in response JSON and long-lived Refresh Token in secure, `httpOnly` cookie.
- `POST /logout` - Clears cookie.
- `POST /refresh` - Issues new access token based on valid refresh cookie.
- `GET /me` - Fetches current user profile from JWT request token.

### Products (`/api/products`)
- `GET /` - List all products (Admin only).
- `GET /in-stock` - List active products with available inventory (both roles for Sales panel).
- `GET /:id` - Get product details.
- `POST /` - Create product (Admin only).
- `PUT /:id` - Update product catalog entry (Admin only).

### Inventory (`/api/inventory`)
- `GET /` - List stock batches.
- `GET /:id` - Get stock batch details.
- `POST /` - Add stock batch (Admin only).
- `PUT /:id` - Update batch quantity/prices manually (Admin only).
- `POST /:id/adjust` - Record manual stock adjustment with reasoning (Admin only).
- `GET /low-stock` - Fetch variants running below critical threshold.
- `GET /expiry-risk` - Fetch batches expiring within 30 days.

### Retailers (`/api/retailers`)
- `GET /` - List all retailers.
- `GET /:id` - Get retailer info.
- `POST /` - Create retailer.
- `PUT /:id` - Update retailer profile.
- `GET /:id/ledger` - Fetch paginated ledger entries for retailer.
- `GET /:id/rgb` - Fetch crate tracking balances.

### Bills (`/api/bills`)
- `POST /` - Creates a bill. Triggers a database transaction: validates limits → depletes FIFO inventory batches → posts ledger entries.
- `GET /` - List bills (Admin: all, Worker: own only).
- `GET /:id` - Get bill details.
- `POST /:id/void` - Soft-deletes bill (cancels transaction), performs inventory reversion, writes ledger reversal, logs audit reason.

### Ledger (`/api/ledger`)
- `GET /` - Combined list and summary across all retailers.
- `GET /retailer/:id` - Fetch retailer ledger entries.
- `POST /payment` - Records direct payment against retailer outstanding balance.

---

## Component Architecture

```
App.tsx (Vite root router)
├── LoginPage
├── Layout (Sidebar + Header shell)
│   ├── Worker Routes
│   │   └── SalesPage
│   │       ├── Product Selector (Brand-first drill-down)
│   │       ├── CartTable
│   │       └── BillSummary
│   └── Admin Routes
│       ├── AdminDashboard
│       │   ├── MetricsCards
│       │   ├── AlertsSection
│       │   └── RecentBillsTable
│       ├── InventoryPage
│       │   ├── StockTable
│       │   ├── AddStockModal
│       │   └── AdjustStockModal
│       ├── RetailersPage
│       │   ├── RetailersTable
│       │   ├── AddRetailerModal
│       │   └── LedgerSummary
│       └── ReportsPage (Sales, Product performance, Worker accountability, Price variance)
└── Notifications (Global toast context)
```

---

## State Management

Zustand (`src/store/index.ts`) is configured to coordinate with backend endpoints. The local store acts as a repository of synced database records:

```typescript
interface Store {
  // Sync States
  currentUser: User | null;
  retailers: Retailer[];
  products: Product[];
  stockBatches: StockBatch[];
  bills: Bill[];
  
  // Actions
  fetchInventory: () => Promise<void>;
  fetchRetailers: () => Promise<void>;
  fetchBills: () => Promise<void>;
  createBill: (billData: any) => Promise<void>;
  // ...
}
```

---

## Authentication Flow

1. User submits credentials on the single login form.
2. API endpoint `/api/auth/login` checks credentials.
3. Server returns Access Token (payload: `id`, `role`, `email`, expires in 15m) and sets Refresh Token in `httpOnly` secure cookie.
4. Client attaches Access Token in `Authorization: Bearer <token>` request header.
5. In case of 401 response (expired access token), the client calls `/api/auth/refresh` automatically to re-authenticate using the refresh cookie without logging the user out.

---

## Business Logic Enforced Server-side

All core business calculations are finalized inside backend services (`/backend/src/modules/`):

### 1. FIFO Stock Movement
When a bill is checkout out:
- System queries active batches of selected products ordered by `expiryDate` (or `purchaseDate` as secondary).
- Deducts required quantities sequentially from oldest batches.
- If total stock is insufficient, the transaction is rolled back.

### 2. Credit limit enforcement
- `Outstanding Debt = Total Purchases - Total Payments`
- A transaction raising outstanding debt above `100%` of the retailer's `creditLimit` is blocked.
- Warning statuses (`70%` and `90%`) are automatically calculated on retailer query.

### 3. Price variance detection
- If billing price < default retail price configured on active stock batches, the line item is logged with variance tags, auto-flagging it in variance query logic.

---

## Security Measures

- **JWT + httpOnly Cookie**: Prevents XSS-based theft of refresh tokens.
- **Transactional Consistency**: Relies on Prisma `$transaction` blocks to ensure stock depletion, ledger balance updates, and invoice writes either succeed together or fail together.
- **RBAC Guards**: Restricts write access and reporting endpoints to accounts carrying the `admin` role.
- **Input Validation**: Uses `Zod` schemas to validate payload structures and prevent SQL injection or database type errors.


# Frontend-Backend API Integration Guide

This guide details the integration layer between the React frontend (running on `http://localhost:5173`) and the Node.js/Express API server (running on `http://localhost:5000`).

---

## 🔗 Connection Configuration

The frontend uses `axios` to interact with backend endpoints. The API client is configured with interceptors to automatically forward authentication headers and manage token expirations.

### API Base Client (`src/services/api.ts`)

```typescript
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enables sending/receiving HttpOnly cookies (Refresh Token)
});

// Request Interceptor: Inject JWT token into headers
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Automatically handle 401 token refresh requests
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If token expired, try to transparently refresh it using refresh token cookie
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { token } = res.data;
        localStorage.setItem("accessToken", token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token expired too -> redirect to login
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🛰️ Implemented Service Modules

The API integrations are structured into services matching the backend controllers:

### 1. Authentication Service (`src/services/auth.ts`)
Handles logins, user session checking, and logouts.
- **Endpoint**: `/api/auth`

```typescript
import { apiClient } from "./api";

export const authService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post("/auth/login", { email, password });
    const { token, user } = response.data;
    localStorage.setItem("accessToken", token);
    return user;
  },

  logout: async () => {
    await apiClient.post("/auth/logout");
    localStorage.removeItem("accessToken");
  },

  getCurrentUser: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  }
};
```

### 2. Products Service (`src/services/products.ts`)
Retrieves and updates the catalog.
- **Endpoint**: `/api/products`

```typescript
import { apiClient } from "./api";

export const productService = {
  getAll: async () => {
    const response = await apiClient.get("/");
    return response.data;
  },
  
  getInStock: async () => {
    const response = await apiClient.get("/in-stock");
    return response.data;
  },

  create: async (productData: any) => {
    const response = await apiClient.post("/", productData);
    return response.data;
  },

  update: async (id: string, productData: any) => {
    const response = await apiClient.put(`/${id}`, productData);
    return response.data;
  }
};
```

### 3. Inventory Service (`src/services/inventory.ts`)
Manages stock batches, low-stock checks, and manual ledger adjustments.
- **Endpoint**: `/api/inventory`

```typescript
import { apiClient } from "./api";

export const inventoryService = {
  getBatches: async () => {
    const response = await apiClient.get("/");
    return response.data;
  },

  addBatch: async (batchData: any) => {
    const response = await apiClient.post("/", batchData);
    return response.data;
  },

  adjustStock: async (batchId: string, adjustment: { quantity: number; reason: string; notes: string }) => {
    const response = await apiClient.post(`/${batchId}/adjust`, adjustment);
    return response.data;
  },

  getLowStock: async () => {
    const response = await apiClient.get("/low-stock");
    return response.data;
  },

  getExpiryRisk: async () => {
    const response = await apiClient.get("/expiry-risk");
    return response.data;
  }
};
```

### 4. Retailers & CRM Service (`src/services/retailers.ts`)
Manages accounts, price tiers, and empty crates (RGB).
- **Endpoint**: `/api/retailers`

```typescript
import { apiClient } from "./api";

export const retailerService = {
  getAll: async () => {
    const response = await apiClient.get("/");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/${id}`);
    return response.data;
  },

  create: async (retailerData: any) => {
    const response = await apiClient.post("/", retailerData);
    return response.data;
  },

  update: async (id: string, retailerData: any) => {
    const response = await apiClient.put(`/${id}`, retailerData);
    return response.data;
  },

  getLedger: async (id: string, page = 1, limit = 10) => {
    const response = await apiClient.get(`/${id}/ledger`, { params: { page, limit } });
    return response.data;
  },

  getRGBBalance: async (id: string) => {
    const response = await apiClient.get(`/${id}/rgb`);
    return response.data;
  }
};
```

### 5. Sales & Invoicing Service (`src/services/bills.ts`)
Coordinates checkout transactions and bill cancellations.
- **Endpoint**: `/api/bills`

```typescript
import { apiClient } from "./api";

export const billService = {
  create: async (billPayload: {
    retailerId: string;
    items: Array<{ productId: string; quantity: number; price: number; discount: number }>;
    discount: number;
    paidAmount: number;
    paymentMode: string;
  }) => {
    const response = await apiClient.post("/", billPayload);
    return response.data;
  },

  list: async () => {
    const response = await apiClient.get("/");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/${id}`);
    return response.data;
  },

  voidBill: async (id: string, reason: string) => {
    const response = await apiClient.post(`/${id}/void`, { reason });
    return response.data;
  }
};
```

### 6. Ledger & Payments Service (`src/services/ledger.ts`)
Records direct debt payments and pulls general ledger statements.
- **Endpoint**: `/api/ledger`

```typescript
import { apiClient } from "./api";

export const ledgerService = {
  getSummary: async () => {
    const response = await apiClient.get("/");
    return response.data;
  },

  recordPayment: async (paymentData: {
    retailerId: string;
    amount: number;
    paymentMode: string;
    notes?: string;
  }) => {
    const response = await apiClient.post("/payment", paymentData);
    return response.data;
  }
};
```

---

## 🔄 Zustand Store Integration Pattern

To connect these service APIs to the frontend state, the Zustand store (`src/store/index.ts`) uses async/await actions that trigger requests, handle load indicators, and save active records.

### Fetching Data Example

```typescript
export const useStore = create<StoreState>((set) => ({
  retailers: [],
  isLoading: false,

  fetchRetailers: async () => {
    set({ isLoading: true });
    try {
      const data = await retailerService.getAll();
      set({ retailers: data.retailers });
    } catch (error) {
      console.error("Failed to load retailers", error);
    } finally {
      set({ isLoading: false });
    }
  }
}));
```

### Submitting Data Example

```typescript
export const useStore = create<StoreState>((set) => ({
  bills: [],
  
  checkoutBill: async (billPayload) => {
    try {
      const result = await billService.create(billPayload);
      set((state) => ({
        bills: [result.bill, ...state.bills]
      }));
      return result;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Checkout failed");
    }
  }
}));
```

---

## 📋 Environment Configuration

To test frontend calls locally, ensure a `.env` file exists at the root of the project:

```env
# POS/.env
VITE_API_URL=http://localhost:5000/api
```

In production build systems, this is replaced by:

```env
# POS/.env.production
VITE_API_URL=https://api.yourposdomain.com/api
```


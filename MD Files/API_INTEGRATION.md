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

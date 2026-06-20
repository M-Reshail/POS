# Backend Integration Guide

## 🔗 Connecting Your Backend

This guide explains how to replace mock data with real API calls.

---

## Step 1: Setup API Configuration

Create `src/services/api.ts`:

```typescript
import axios, { AxiosInstance } from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor: Add JWT token
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: Handle 401 (token expired)
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem("authToken");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    },
  );

  return client;
};

export const apiClient = createApiClient();
```

---

## Step 2: Create API Service Functions

Create `src/services/auth.ts`:

```typescript
import { apiClient } from "./api";

export const authService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post("/auth/login", { email, password });
    const { token, user } = response.data;
    localStorage.setItem("authToken", token);
    return user;
  },

  logout: async () => {
    localStorage.removeItem("authToken");
  },

  getCurrentUser: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
};
```

Create `src/services/bills.ts`:

```typescript
import { apiClient } from "./api";
import { Bill } from "../types";

export const billService = {
  createBill: async (bill: Bill) => {
    const response = await apiClient.post("/bills", bill);
    return response.data;
  },

  getBills: async () => {
    const response = await apiClient.get("/bills");
    return response.data;
  },

  getBillById: async (id: string) => {
    const response = await apiClient.get(`/bills/${id}`);
    return response.data;
  },

  printBill: async (id: string) => {
    const response = await apiClient.get(`/bills/print/${id}`);
    return response.data;
  },
};
```

Create `src/services/inventory.ts`:

```typescript
import { apiClient } from "./api";
import { StockBatch } from "../types";

export const inventoryService = {
  getStock: async () => {
    const response = await apiClient.get("/stock");
    return response.data;
  },

  addStock: async (batch: StockBatch) => {
    const response = await apiClient.post("/stock", batch);
    return response.data;
  },

  adjustStock: async (batchId: string, quantity: number, reason: string) => {
    const response = await apiClient.post(`/stock/${batchId}/adjust`, {
      quantity,
      reason,
    });
    return response.data;
  },

  getLowStock: async () => {
    const response = await apiClient.get("/stock/low-stock");
    return response.data;
  },

  getExpiryRisk: async () => {
    const response = await apiClient.get("/stock/expiry-risk");
    return response.data;
  },
};
```

Create `src/services/retailers.ts`:

```typescript
import { apiClient } from "./api";
import { Retailer } from "../types";

export const retailerService = {
  getRetailers: async () => {
    const response = await apiClient.get("/retailers");
    return response.data;
  },

  getRetailerById: async (id: string) => {
    const response = await apiClient.get(`/retailers/${id}`);
    return response.data;
  },

  createRetailer: async (retailer: Retailer) => {
    const response = await apiClient.post("/retailers", retailer);
    return response.data;
  },

  updateRetailer: async (id: string, retailer: Partial<Retailer>) => {
    const response = await apiClient.put(`/retailers/${id}`, retailer);
    return response.data;
  },

  getLedger: async (retailerId: string) => {
    const response = await apiClient.get(`/retailers/${retailerId}/ledger`);
    return response.data;
  },
};
```

---

## Step 3: Update Components to Use API

### Example: Update LoginPage

**Before (Mock):**

```typescript
const mockUsers: Record<string, { password: string; user: User }> = {
  "admin@pos.com": {
    password: "admin123",
    // ...
  },
};

const handleLogin = async (e: React.FormEvent) => {
  const userRecord = mockUsers[email];
  if (userRecord && userRecord.password === password) {
    setCurrentUser(userRecord.user);
  }
};
```

**After (Real API):**

```typescript
import { authService } from "../../services/auth";

const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const user = await authService.login(email, password);
    setCurrentUser(user);
    navigate(user.role === "admin" ? "/admin/dashboard" : "/worker/sales");
  } catch (error: any) {
    setError(error.response?.data?.message || "Login failed");
  } finally {
    setLoading(false);
  }
};
```

### Example: Update AdminDashboard

**Before (Mock):**

```typescript
export const AdminDashboard: React.FC = () => {
  const bills = useStore((state) => state.bills);
  const products = useStore((state) => state.products);
  const retailers = useStore((state) => state.retailers);
  // ... use mock data
};
```

**After (Real API):**

```typescript
export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const bills = useStore((state) => state.bills);
  const setBills = useStore((state) => state.setBills);

  React.useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [billsData] = await Promise.all([
        billService.getBills(),
        inventoryService.getStock(),
        retailerService.getRetailers(),
      ]);
      setBills(billsData);
    } catch (error) {
      console.error('Failed to load dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  // ... rest of component
};
```

---

## Step 4: Update Zustand Store for API Data

Create async thunks in `src/store/index.ts`:

```typescript
export const useStore = create<Store>((set) => ({
  // ... existing state

  // Async actions
  fetchBills: async () => {
    try {
      const bills = await billService.getBills();
      set({ bills });
    } catch (error) {
      console.error("Failed to fetch bills", error);
    }
  },

  fetchRetailers: async () => {
    try {
      const retailers = await retailerService.getRetailers();
      set({ retailers });
    } catch (error) {
      console.error("Failed to fetch retailers", error);
    }
  },

  fetchInventory: async () => {
    try {
      const stockBatches = await inventoryService.getStock();
      set({ stockBatches });
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    }
  },
}));
```

Usage in components:

```typescript
const fetchBills = useStore((state) => state.fetchBills);

useEffect(() => {
  fetchBills();
}, []);
```

---

## Step 5: Environment Configuration

Create `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Beverage POS
```

Update `src/services/api.ts`:

```typescript
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
```

For production `.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_APP_NAME=Beverage POS
```

---

## Step 6: Error Handling & Notifications

```typescript
import { useStore } from "../store";

export const handleApiError = (error: any) => {
  const addNotification = useStore.getState().addNotification;

  if (error.response?.status === 401) {
    addNotification("error", "Session expired. Please login again.");
    window.location.href = "/login";
  } else if (error.response?.status === 403) {
    addNotification("error", "You do not have permission to do this.");
  } else if (error.response?.status === 404) {
    addNotification("error", "Resource not found.");
  } else if (error.response?.status >= 500) {
    addNotification("error", "Server error. Please try again later.");
  } else if (error.message === "Network Error") {
    addNotification("error", "Network error. Check your connection.");
  } else {
    addNotification(
      "error",
      error.response?.data?.message || "An error occurred.",
    );
  }
};
```

---

## Step 7: Loading States & Skeletons

```typescript
const SkeletonLoader: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-gray-200 h-12 rounded animate-pulse" />
    ))}
  </div>
);

// Usage
{loading ? <SkeletonLoader /> : <BillsTable bills={bills} />}
```

---

## Backend Example (Node.js/Express)

Here's a minimal backend example:

```typescript
// backend/routes/auth.ts
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate credentials against database
  const user = await User.findOne({ email });
  if (!user || !(await user.validatePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  res.json({ token, user });
});

export default router;
```

```typescript
// backend/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
```

---

## Step 8: Testing the Integration

1. Start your backend server (port 5000)
2. Start the frontend dev server
3. Try logging in - you should see real API calls in Network tab
4. Mock data removal checklist:
   - [ ] Remove mockUsers from LoginPage
   - [ ] Remove mockRetailers from all pages
   - [ ] Remove mockProducts from all pages
   - [ ] Remove mockStockBatches from all pages
   - [ ] All data now comes from API

---

## Debugging API Issues

```typescript
// Enable verbose logging
const apiClient = axios.create({...});

apiClient.interceptors.request.use((config) => {
  console.log('Request:', config.method?.toUpperCase(), config.url, config.data);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log('Response:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);
```

---

## Building for Production

```bash
# Set production API URL
export VITE_API_URL=https://api.yourdomain.com/api

# Build
npm run build

# Test build locally
npm run preview

# Deploy 'dist' folder to hosting
```

---

## Checklist for Full Integration

- [ ] Create all service files
- [ ] Setup API client with interceptors
- [ ] Update authentication
- [ ] Update AdminDashboard to fetch data
- [ ] Update Inventory page
- [ ] Update Retailers page
- [ ] Update Reports page
- [ ] Update Worker Sales page
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test all workflows
- [ ] Remove mock data
- [ ] Setup environment variables
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Monitor error logs

---

Good luck with your backend integration!

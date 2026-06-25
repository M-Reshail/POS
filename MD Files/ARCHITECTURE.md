# System Architecture & Implementation Guide

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema (Proposed)](#database-schema-proposed)
4. [API Endpoints (For Backend Integration)](#api-endpoints)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Authentication Flow](#authentication-flow)
8. [Business Logic](#business-logic)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Beverage POS System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        React Frontend (Vite + TypeScript)             │   │
│  ├───────────────────┬────────────────────────────────┤   │
│  │  Admin Module     │      Worker Module              │   │
│  │  - Dashboard      │  - Sales Billing               │   │
│  │  - Inventory      │  - Cart Management             │   │
│  │  - Retailers      │  - Price Override              │   │
│  │  - Reports        │  - Print Preview               │   │
│  └───────────────────┴────────────────────────────────┘   │
│                         │                                    │
│                    Zustand Store                             │
│       (Current global state with mock data)                  │
│                         │                                    │
├─────────────────────────────────────────────────────────────┤
│               [To Be Connected] Backend API                 │
│  - Node.js/Express or Python/Django or ASP.NET             │
│  - Authentication & JWT                                     │
│  - Database Operations                                      │
│  - Business Logic Validation                                │
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
| State Mgmt | Zustand      | 4.4.2   | Global State           |
| Routing    | React Router | 6.20.0  | Client-Side Navigation |
| Icons      | Lucide React | 0.344.0 | SVG Icons              |
| Date Utils | date-fns     | 2.30.0  | Date Manipulation      |

### Backend (To Be Implemented)

- Node.js/Express or Python/Django or ASP.NET
- PostgreSQL or MongoDB
- JWT Authentication
- RESTful or GraphQL API

---

## Database Schema (Proposed)

_Note: The frontend currently uses TypeScript interfaces mapped closely to this relational schema._

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'worker') NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Products Table

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  brand VARCHAR(100) NOT NULL,
  category ENUM('soft-drink', 'juice', 'water', 'energy-drink') NOT NULL,
  variant VARCHAR(100) NOT NULL,
  pet_conversion_factor INT NOT NULL,
  description TEXT
);
```

### Stock Batches Table

```sql
CREATE TABLE stock_batches (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  buy_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  batch_number VARCHAR(50) UNIQUE NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_date DATE NOT NULL,
  supplier_id UUID,
  supplier VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (product_id),
  INDEX (expiry_date)
);
```

### Stock Adjustments Table

```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES stock_batches(id),
  quantity INT NOT NULL,
  reason ENUM('damage', 'theft', 'manual-correction') NOT NULL,
  notes TEXT,
  admin_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Retailers Table

```sql
CREATE TABLE retailers (
  id UUID PRIMARY KEY,
  shop_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  delivery_location TEXT,
  credit_limit DECIMAL(12,2) NOT NULL,
  price_tier ENUM('standard', 'premium', 'discount') DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Bills Table

```sql
CREATE TABLE bills (
  id UUID PRIMARY KEY,
  bill_number VARCHAR(50) UNIQUE NOT NULL,
  retailer_id UUID NOT NULL REFERENCES retailers(id),
  worker_id UUID NOT NULL REFERENCES users(id),
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  pending_amount DECIMAL(12,2) NOT NULL,
  payment_mode ENUM('cash', 'credit', 'udhar', 'generate-only'),
  previous_pending_added DECIMAL(12,2),
  old_pending_payment_applied DECIMAL(12,2),
  status ENUM('pending', 'paid', 'partial') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (retailer_id),
  INDEX (worker_id),
  INDEX (created_at)
);
```

### Bill Items Table

```sql
CREATE TABLE bill_items (
  id UUID PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  INDEX (bill_id)
);
```

### Payment Records Table

```sql
CREATE TABLE payment_records (
  id UUID PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_mode ENUM('cash', 'credit', 'udhar', 'generate-only'),
  notes TEXT
);
```

### Ledger Table

```sql
CREATE TABLE ledger (
  id UUID PRIMARY KEY,
  retailer_id UUID NOT NULL REFERENCES retailers(id),
  bill_id UUID REFERENCES bills(id),
  entry_type ENUM('sale', 'payment', 'return', 'adjustment') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance DECIMAL(12,2) NOT NULL,
  payment_mode ENUM('cash', 'bank-transfer', 'check'),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (retailer_id),
  INDEX (created_at)
);
```

### Price History Table

```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  old_price DECIMAL(10,2) NOT NULL,
  new_price DECIMAL(10,2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### RGB Tracking Table

```sql
CREATE TABLE rgb_tracking (
  id UUID PRIMARY KEY,
  retailer_id UUID NOT NULL UNIQUE REFERENCES retailers(id),
  issued_quantity INT NOT NULL DEFAULT 0,
  returned_quantity INT NOT NULL DEFAULT 0,
  balance INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Voided Bill Logs Table

```sql
CREATE TABLE voided_bill_logs (
  id UUID PRIMARY KEY,
  bill_id UUID NOT NULL,
  worker_id UUID NOT NULL REFERENCES users(id),
  voided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bill_value DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL
);
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/login           - Login user
POST   /api/auth/logout          - Logout user
POST   /api/auth/refresh-token   - Refresh JWT token
GET    /api/auth/me             - Get current user
```

### Products

```
GET    /api/products             - List all products
GET    /api/products/:id         - Get product details
POST   /api/products             - Create product (Admin)
PUT    /api/products/:id         - Update product (Admin)
```

### Stock

```
GET    /api/stock                - List stock batches
POST   /api/stock                - Add stock batch (Admin)
PUT    /api/stock/:id            - Update stock (Admin)
POST   /api/stock/:id/adjust     - Adjust stock (Admin)
GET    /api/stock/low-stock      - Get low stock alerts
GET    /api/stock/expiry-risk    - Get expiry risk products
```

### Retailers

```
GET    /api/retailers            - List all retailers
GET    /api/retailers/:id        - Get retailer details
POST   /api/retailers            - Create retailer (Admin)
PUT    /api/retailers/:id        - Update retailer (Admin)
GET    /api/retailers/:id/ledger - Get retailer ledger
```

### Bills

```
POST   /api/bills                - Create bill
GET    /api/bills                - List bills
GET    /api/bills/:id            - Get bill details
GET    /api/bills/print/:id      - Print bill
POST   /api/bills/:id/cancel     - Cancel bill (Admin)
```

### Ledger

```
GET    /api/ledger/retailer/:id  - Get retailer account
POST   /api/ledger/payment       - Record payment (Admin)
```

### Reports

```
GET    /api/reports/sales        - Sales report
GET    /api/reports/products     - Product performance
GET    /api/reports/workers      - Worker performance
GET    /api/reports/price-variance - Price variance report
GET    /api/reports/credit       - Credit/Ledger report
```

---

## Component Architecture

### Component Tree

```
App.tsx
├── LoginPage
├── Layout (Sidebar + Header)
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
│       └── ReportsPage
│           ├── ReportFilter
│           ├── SalesReport
│           ├── ProductReport
│           ├── WorkerReport
│           ├── PriceVarianceReport
│           └── CreditReport
└── Notifications
```

### Common Components

- `Button` - Primary action button
- `Input` - Text input with label
- `Select` - Dropdown selector
- `Card` - Container card
- `Badge` - Status badge
- `Modal` - Dialog modal

---

## State Management

### Current Implementation

The application currently relies entirely on **Zustand** for state management, operating on purely client-side mock data without hitting external API endpoints.

```typescript
interface Store {
  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // Data
  retailers: Retailer[];
  products: Product[];
  stockBatches: StockBatch[];
  bills: Bill[];

  // Current Operations
  currentBill: Partial<Bill> | null;
  setCurrentBill: (bill: Partial<Bill> | null) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (type: string, message: string) => void;
  removeNotification: (id: string) => void;
}
```

### Store Usage Example

```typescript
// Get state
const bills = useStore((state) => state.bills);

// Update state
const addBill = useStore((state) => state.addBill);
addBill(newBill);
```

---

## Authentication Flow

### Planned API Flow

```
1. User enters email/password
   ↓
2. Frontend sends to /api/auth/login
   ↓
3. Backend validates credentials
   ↓
4. Backend returns JWT token + user data
   ↓
5. Frontend stores token (localStorage/session)
   ↓
6. Frontend sets currentUser in Zustand
   ↓
7. Redirects to dashboard/sales based on role
```

### Protected Routes

```typescript
<Route
  path="/admin/dashboard"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

---

## Business Logic

### PET Conversion Formula

```
Physical Units = PET Units × Conversion Factor
Example: Pepsi 1.5L (1 PET) = 12 bottles

Stock Calculation:
- Display to user: In PET units
- Purchase: In PET units
- Sales: In PET units
- Reports: Aggregated in PET units
```

### Credit Management

```
Outstanding = Total Billed - Total Paid
Credit Available = Credit Limit - Outstanding

Alert Triggers:
- Orange: Outstanding > 70% of limit
- Red: Outstanding > 90% of limit
- Block: Outstanding > 100% of limit
```

### Price Variance Detection

```
Flag Condition: Billed Price < Default Price
Report Fields:
- Product
- Default Price
- Billed Price
- Discount %
- Worker Name
- Date/Time
```

### FIFO Stock Movement

```
When selling:
1. Get oldest batch of product
2. Check available quantity
3. Reduce quantity from batch
4. Move to next batch when empty
5. Log transaction
```

---

## Security Measures

- ✅ Input validation and sanitization
- ✅ SQL injection prevention (use ORM)
- ✅ XSS protection
- ✅ CSRF tokens
- ✅ JWT token expiration
- ✅ Rate limiting on API endpoints
- ✅ HTTPS only in production
- ✅ Secure password hashing
- ✅ Role-based access control
- ✅ Audit logging for critical operations
- ✅ Data encryption at rest
- ✅ Regular security updates

---

## Monitoring & Logging

### What to Monitor

- API response times
- Error rates
- Database performance
- User activity
- Stock movements
- Credit transactions

### Logging Strategy

- Info: Bill creation, stock updates, payments
- Warning: Low stock, credit limit alerts
- Error: System errors, failed transactions
- Debug: Detailed request/response logs

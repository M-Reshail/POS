# Business Rules

This document outlines the core business rules and logic enforced by the Beverage POS System. These rules govern data validation, workflow restrictions, calculations, and automated behaviors, and they are programmatically enforced on both the React frontend and inside the Node.js/Express service layers to guarantee database integrity.

## Table of Contents

- [Stock & Inventory Rules](#stock--inventory-rules)
- [Sales & Billing Rules](#sales--billing-rules)
- [Retailer & Credit Rules](#retailer--credit-rules)
- [Audit & Security Rules](#audit--security-rules)

---

## Stock & Inventory Rules

### 1. Direct Variant Stock Tracking
- **Rule:** All product quantities are tracked and sold directly by their physical packaging variant unit (e.g., a case of 1.5L PET, a carton of 250ml Glass, a single Can).
- **Why:** To simplify workflows and eliminate conversion confusion — products are sold as they are packaged.
- **Enforcement:** Enforced in database stock batches and frontend selection screens.

### 2. Batch-Based Expiry Monitoring
- **Rule:** Inventory must be tracked in distinct batches with attached purchase and expiry dates. The system must categorize batch statuses into color-coded risks based on their proximity to the expiry date.
- **Why:** To prevent the sale of expired goods and allow admins to prioritize moving older stock.
- **Enforcement:** Automatically tracked by the inventory service (`inventory.service.ts`) through SQL queries checking the date offsets.

### 3. Justified Stock Adjustments
- **Rule:** Any manual deduction of stock outside of a standard sales transaction must be accompanied by an explicit reason code (e.g., `damage`, `theft`, `manual_correction`) and an Admin ID.
- **Why:** To ensure inventory shrinkage is accurately categorized and accounted for in audit logs.
- **Enforcement:** The `/api/inventory/:id/adjust` endpoint validates the admin session and payload schema before creating a transaction log.

---

## Sales & Billing Rules

### 1. Price Variance Detection
- **Rule:** If a worker processes a bill where a product's final selling price is lower than its system-defined default price, the transaction must be flagged automatically in the database (which populates the Price Variance Report).
- **Why:** To prevent unauthorized discounting and ensure owners have visibility into revenue leakage.
- **Enforcement:** Computed dynamically in `bill.service.ts` by comparing input prices against active stock batch prices.

### 2. Bill Immutability
- **Rule:** Once a bill is finalized, its line items and totals cannot be edited or deleted by a Worker. 
- **Why:** To maintain strict financial compliance and prevent post-transaction tampering.
- **Enforcement:** The database has no update route for bills; workers have no access to void routes.

### 3. FIFO Sales Depletion
- **Rule:** When a sale is finalized, stock must be deducted starting from the oldest available stock batch (determined by expiry date, then purchase date) for that specific product until the required quantity is met.
- **Why:** First-In-First-Out (FIFO) ensures that older inventory is liquidated before newer inventory, reducing spoilage risk.
- **Enforcement:** Implemented transactionally in the inventory depletion service (`deductStockFIFO()`) when processing checkouts.

---

## Retailer & Financial Rules

### 1. Retailer Account Management
- **Rule:** Retailers maintain profile information (shop name, owner name, mobile number, address) and an integrated financial ledger. Outstanding balances are automatically tracked across all unpaid bills and direct payment postings.
- **Why:** To maintain clear, transparent records of Udhari (credit debt) per retailer without arbitrary credit ceilings.
- **Enforcement:** Enforced in `retailer.service.ts` and `ledger.service.ts`.

### 2. Ledger Integrity
- **Rule:** Any payment made by a retailer that is less than the total bill value must automatically generate a `sale` entry and a corresponding pending balance in the retailer's ledger. Subsequent payments must generate `payment` entries that reduce this balance.
- **Why:** To guarantee that the retailer's outstanding balance always perfectly matches the sum of their unpaid bills and recorded payments.
- **Enforcement:** Enforced in `bill.service.ts` and `ledger.service.ts` inside atomic database transactions.

### 3. Itemized Crate (RGB) Balancing & Standalone Exchanges
- **Rule:** Returnable Glass Bottles (RGB) crates are tracked independently of cash balance by crate item type (e.g. "Coca Cola RGB", "Pepsi RGB"). Crate issues increase a retailer's outstanding crate debt and deduct warehouse stock; crate returns reduce retailer crate debt and restock the warehouse. Standalone crate exchanges (empty cart) log an `RGBTransaction` directly without creating a `Bill` record.
- **Why:** Crates are physical assets returned to manufacturers independently of monetary product invoices.
- **Enforcement:** Managed atomically in `rgb.service.ts` inside PostgreSQL transactions.

---

## Audit & Security Rules

### 1. Strict Role Permissions
- **Rule:** 
  - **Workers** are strictly confined to the sales billing routes and RGB crate exchange screens. They cannot view analytical reports, change default product prices, or modify retailer profiles.
  - **Admins** have global read/write access across all routes and features.
- **Why:** To protect sensitive financial data and prevent unauthorized pricing alterations.
- **Enforcement:** Middleware layers (`auth.ts` and `requireRole.ts`) intercept all backend routes to authorize incoming requests.

### 2. Shared-PC Multi-Worker Session Security
- **Rule:**
  - Access Tokens expire after 12 hours (`JWT_ACCESS_EXPIRES_IN=12h`) and Refresh Tokens expire after 10 hours (`JWT_REFRESH_EXPIRES_IN=10h`).
  - An Inactivity Timer monitors user inputs (mouse, keyboard, touch, scroll) and automatically expires the session after 15 minutes of inactivity.
  - When a session expires, a `CustomEvent('session-expired')` is dispatched, rendering a backdrop-blurred modal overlay that prompts the worker to log back in without losing in-memory cart state or forcing an abrupt page reload.
  - Sidebar layout includes a shift-end security warning instructing workers to log out when leaving their shift.
- **Why:** Prevents upcoming shift workers from mistakenly executing transactions under a previous worker's account on shared shop PCs.
- **Enforcement:** Enforced via `auth.ts` middleware, `InactivityTimer` component in `App.tsx`, and dynamic `httpOnly` cookie maxAge calculation in `auth.controller.ts`.

### 3. Voided Bill Logging
- **Rule:** If a bill needs to be cancelled (voided), it must not be hard-deleted from the database. Instead, it must be marked as void (soft-delete) and logged in the `voided_bill_logs` table along with the total value of the bill, the worker who processed it, and a required reason.
- **Why:** To prevent "ghost transactions" where a worker creates a bill, collects cash, and then deletes the bill to pocket the money.
- **Enforcement:** Enforced inside the `voidBill()` database transaction which reverses stock, reverses ledger balances, and logs details.

### 4. Timestamped Accountability
- **Rule:** All financial transactions, stock adjustments, and price modifications must be securely timestamped and associated with the ID of the user who performed the action.
- **Why:** To ensure full traceability and accountability for every system mutation.
- **Enforcement:** Enforced by PostgreSQL schema defaults (`@default(now())`) and session user ID injections on write controllers.


# Business Rules

This document outlines the core business rules and logic enforced by the Beverage POS System. These rules govern data validation, workflow restrictions, calculations, and automated behaviors, and they are programmatically enforced on both the React frontend and inside the Node.js/Express service layers to guarantee database integrity.

## Table of Contents

- [Stock & Inventory Rules](#stock--inventory-rules)
- [Sales & Billing Rules](#sales--billing-rules)
- [Retailer & Credit Rules](#retailer--credit-rules)
- [Audit & Security Rules](#audit--security-rules)

---

## Stock & Inventory Rules

### 1. PET Unit Standardization
- **Rule:** All liquid stock quantities must be calculated and displayed in "Bottle Equivalent" (PET) units, regardless of their physical packaging.
- **Why:** To maintain a unified metric for volume tracking across different package sizes (e.g., cans vs. 1.5L bottles vs. 5L jugs).
- **Calculation:** `Physical Units = PET Units × petConversionFactor`
- **Enforcement:** Enforced in both the UI selection screens and the backend database fields.

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

## Retailer & Credit Rules

### 1. Credit Limit Enforcement
- **Rule:** Retailers cannot exceed their designated `creditLimit`. The system tracks the outstanding balance across all their bills to calculate their available credit.
- **Why:** To mitigate financial risk from retailers who fail to pay their Udhari (credit) on time.
- **Enforcement:** Verified in `bill.service.ts` during checkout. If the checkout raises the retailer's outstanding balance beyond their credit ceiling, the transaction is rejected and rolled back.
- **Status Automation:**
  - **Orange Warning:** Outstanding balance exceeds 70% of the credit limit.
  - **Red Alert:** Outstanding balance exceeds 90% of the credit limit.
  - **Block:** Outstanding balance exceeds 100% of the credit limit (Blocks sales).

### 2. Ledger Integrity
- **Rule:** Any payment made by a retailer that is less than the total bill value must automatically generate a `sale` entry and a corresponding pending balance in the retailer's ledger. Subsequent payments must generate `payment` entries that reduce this balance.
- **Why:** To guarantee that the retailer's outstanding balance always perfectly matches the sum of their unpaid bills and recorded payments.
- **Enforcement:** Enforced in `bill.service.ts` and `ledger.service.ts` inside atomic database transactions.

### 3. Crate (RGB) Balancing
- **Rule:** The system must independently track Returnable Glass Bottles (RGB) crates issued versus returned. The RGB balance cannot be cleared simply by paying a monetary bill; it requires physical crate returns to be logged.
- **Why:** Because crates represent physical assets that must be returned to the manufacturer, independent of the liquid product sold.
- **Enforcement:** Managed in the retailer module ledger and separate crate records in `rgb_tracking` table.

---

## Audit & Security Rules

### 1. Strict Role Permissions
- **Rule:** 
  - **Workers** are strictly confined to the sales billing routes. They cannot view analytical reports, change default product prices, or modify retailer profiles.
  - **Admins** have global read/write access across all routes and features.
- **Why:** To protect sensitive financial data and prevent unauthorized pricing alterations.
- **Enforcement:** Middleware layers (`auth.ts` and `requireRole.ts`) intercept all backend routes to authorize incoming requests.

### 2. Voided Bill Logging
- **Rule:** If a bill needs to be cancelled (voided), it must not be hard-deleted from the database. Instead, it must be marked as void (soft-delete) and logged in the `voided_bill_logs` table along with the total value of the bill, the worker who processed it, and a required reason.
- **Why:** To prevent "ghost transactions" where a worker creates a bill, collects cash, and then deletes the bill to pocket the money.
- **Enforcement:** Enforced inside the `voidBill()` database transaction which reverses stock, reverses ledger balances, and logs details.

### 3. Timestamped Accountability
- **Rule:** All financial transactions, stock adjustments, and price modifications must be securely timestamped and associated with the ID of the user who performed the action.
- **Why:** To ensure full traceability and accountability for every system mutation.
- **Enforcement:** Enforced by PostgreSQL schema defaults (`@default(now())`) and session user ID injections on write controllers.

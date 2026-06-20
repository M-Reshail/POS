# Business Rules

This document outlines the core business rules and logic enforced by the Beverage POS System. These rules govern data validation, workflow restrictions, calculations, and automated behaviors across the application.

## Table of Contents

- [Stock & Inventory Rules](#stock--inventory-rules)
- [Sales & Billing Rules](#sales--billing-rules)
- [Retailer & Credit Rules](#retailer--credit-rules)
- [Audit & Security Rules](#audit--security-rules)

---

## Stock & Inventory Rules

### 1. PET Unit Standardization
**Rule:** All liquid stock quantities must be calculated and displayed in "Bottle Equivalent" (PET) units, regardless of their physical packaging.
**Why:** To maintain a unified metric for volume tracking across different package sizes (e.g., cans vs. 1.5L bottles vs. 5L jugs).
**Calculation:** `Physical Units = PET Units × petConversionFactor`

### 2. Batch-Based Expiry Monitoring
**Rule:** Inventory must be tracked in distinct batches with attached purchase and expiry dates. The system must categorize batch statuses into color-coded risks based on their proximity to the expiry date.
**Why:** To prevent the sale of expired goods and allow admins to prioritize moving older stock.

### 3. Justified Stock Adjustments
**Rule:** Any manual deduction of stock outside of a standard sales transaction must be accompanied by an explicit reason code (e.g., `damage`, `theft`, `manual-correction`) and an Admin ID.
**Why:** To ensure inventory shrinkage is accurately categorized and accounted for in audit logs.

---

## Sales & Billing Rules

### 1. Price Variance Detection
**Rule:** If a worker processes a bill where a product's final selling price is lower than its system-defined default price, the transaction must be flagged automatically in the Price Variance Report.
**Why:** To prevent unauthorized discounting and ensure owners have visibility into revenue leakage.

### 2. Bill Immutability
**Rule:** Once a bill is finalized, its line items and totals cannot be edited or deleted by a Worker. 
**Why:** To maintain strict financial compliance and prevent post-transaction tampering.

### 3. FIFO Sales Depletion (Framework)
**Rule:** When a sale is finalized, stock must be deducted starting from the oldest available stock batch for that specific product until the required quantity is met.
**Why:** First-In-First-Out (FIFO) ensures that older inventory is liquidated before newer inventory, reducing spoilage risk.

---

## Retailer & Credit Rules

### 1. Credit Limit Enforcement
**Rule:** Retailers cannot exceed their designated `credit_limit`. The system tracks the `pending_amount` across all their bills to calculate their outstanding balance.
**Why:** To mitigate financial risk from retailers who fail to pay their Udhari (credit) on time.
**Status Automation:**
- **Orange Warning:** Outstanding balance exceeds 70% of the credit limit.
- **Red Alert:** Outstanding balance exceeds 90% of the credit limit.
- **Block:** Outstanding balance exceeds 100% of the credit limit.

### 2. Ledger Integrity
**Rule:** Any payment made by a retailer that is less than the total bill value must automatically generate a `sale` entry and a corresponding pending balance in the retailer's ledger. Subsequent payments must generate `payment` entries that reduce this balance.
**Why:** To guarantee that the retailer's outstanding balance always perfectly matches the sum of their unpaid bills and recorded payments.

### 3. Crate (RGB) Balancing
**Rule:** The system must independently track Returnable Glass Bottles (RGB) crates issued versus returned. The RGB balance cannot be cleared simply by paying a monetary bill; it requires physical crate returns to be logged.
**Why:** Because crates represent physical company assets that must be returned to the manufacturer, independent of the liquid product sold.

---

## Audit & Security Rules

### 1. Strict Role Permissions
**Rule:** 
- **Workers** are strictly confined to the `/worker/sales` route. They cannot view analytical reports, change default product prices, or modify retailer profiles.
- **Admins** have global read/write access across all routes and features.
**Why:** To protect sensitive financial data and prevent unauthorized pricing alterations.

### 2. Voided Bill Logging
**Rule:** If a bill needs to be cancelled (voided), it must not be hard-deleted from the database. Instead, it must be logged in the `voided_bill_logs` table along with the total value of the bill, the worker who processed it, and a required reason.
**Why:** To prevent "ghost transactions" where a worker creates a bill, collects cash, and then deletes the bill to pocket the money.

### 3. Timestamped Accountability
**Rule:** All financial transactions, stock adjustments, and price modifications must be securely timestamped and associated with the ID of the user who performed the action.
**Why:** To ensure full traceability and accountability for every system mutation.

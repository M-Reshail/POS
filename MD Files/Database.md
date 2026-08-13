# Database Structure

This document outlines the database schemas and relationships for the Beverage POS System. The database layer is implemented on **PostgreSQL** and managed programmatically via **Prisma ORM**.

The source schema file is located at [schema.prisma](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/backend/prisma/schema.prisma).

---

## Entity Relationship Overview

```
                 ┌──────────────┐
                 │     User     │
                 └──────┬───────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
 ┌──────────────┐ ┌──────────┐ ┌──────────────┐
 │StockAdjustm't│ │   Bill   │ │PriceHistory  │
 └──────┬───────┘ └───┬──┬───┘ └──────┬───────┘
        │             │  │            │
        ▼             │  │            ▼
 ┌──────────────┐     │  └──────┐ ┌───────────┐
 │  StockBatch  │     │         │ │  Product  │
 └──────┬───────┘     │         │ └─────┬─────┘
        │             │         │       │
        ▼             ▼         ▼       │
 ┌──────────────┐ ┌──────┐  ┌─────────┐ │
 │   Retailer   ├─►Ledger│  │BillItem ├─┘
 └──────┬───────┘ └──────┘  └─────────┘
        │
        ▼
 ┌──────────────┐
 │ RGBTracking  │
 └──────────────┘
```

---

## Schema Documentation

### 1. User (`users`)
Represents system operators (Admins and Workers).

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `name` | String | | Full name |
| `email` | String | Unique | Login email |
| `passwordHash` | String | `@map("password_hash")` | bcrypt hash of user password |
| `role` | `UserRole` (Enum) | | Privilege tier: `admin` or `worker` |
| `isActive` | Boolean | Default: `true` | Allows/blocks logins |
| `createdAt` | DateTime | Default: `now()` | Registration timestamp |

---

### 1a. Brand (`brands`)
Represents product brands (e.g. 'Pepsi', 'Coca Cola'). Images are stored at the brand level, allowing all variants under a brand to share it.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `name` | String | Unique | Normalized lowercase key (e.g., 'pepsi') |
| `displayName` | String | `@map("display_name")` | Display casing shown in the UI (e.g., 'Pepsi') |
| `imageUrl` | String | `@map("image_url")`, Nullable | Brand image served statically |
| `createdAt` | DateTime | `@map("created_at")`, Default: `now()` | Creation timestamp |
| `updatedAt` | DateTime | `@map("updated_at")`, Updated automatic | Last modification timestamp |

---

### 2. Product (`products`)
Unified catalog of products (beverages, snacks, general groceries) linked to a parent brand.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `brandId` | String | `@map("brand_id")`, FK -> `Brand.id` | Link to the brand relation |
| `brand` | String | | Legacy brand name (kept for backward compat) |
| `category` | String | Default: `"general"` | Free-text category tag (no enum lock-in) |
| `variant` | String | | Size/Packaging details (e.g. '1.5L', 'Can') |
| `imageUrl` | String | `@map("image_url")`, Nullable | Legacy product image URL (deprecated) |
| `description` | String | Nullable | Optional notes |
| `isActive` | Boolean | `@map("is_active")`, Default: `true` | Soft-deleted filter |


---

### 2a. RGBItem (`rgb_items`)
Standalone Returnable Glass Bottle (crate) stock counts in the warehouse.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `name` | String | Unique | Crate item name (e.g. 'Coca Cola RGB', 'Pepsi RGB') |
| `stockQuantity` | Int | `@map("stock_quantity")`, Default: `0` | Active empty crates count in warehouse stock |
| `lastUpdated` | DateTime | `@map("last_updated")`, Updated automatic | Last stepper adjustment timestamp |

---

### 2b. RGBRetailerBalance (`rgb_retailer_balances`)
Tracks per-retailer, per-item outstanding crate balances (`balance > 0` means retailer currently owes crates back).

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `retailerId` | String | `@map("retailer_id")`, FK -> `Retailer.id` | Customer retailer reference |
| `rgbItemId` | String | `@map("rgb_item_id")`, FK -> `RGBItem.id` | Crate item reference |
| `balance` | Int | Default: `0` | Outstanding crate count owed by retailer |
| `updatedAt` | DateTime | `@map("updated_at")`, Updated automatic | Timestamp of last balance change |

---

### 2c. RGBTransaction (`rgb_transactions`)
Audit trail log of crate issue and return exchanges.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `retailerId` | String | `@map("retailer_id")`, FK -> `Retailer.id` | Customer retailer reference |
| `rgbItemId` | String | `@map("rgb_item_id")`, FK -> `RGBItem.id` | Crate item reference |
| `type` | `RGBTransactionType` (Enum) | | Action: `ISSUE` or `RETURN` |
| `quantity` | Int | | Number of crates exchanged |
| `saleId` | String | `@map("sale_id")`, Nullable | Connected bill ID (loose FK, null for standalone exchanges) |
| `workerId` | String | `@map("worker_id")`, Nullable | Processing worker ID (loose FK) |
| `createdAt` | DateTime | `@map("created_at")`, Default: `now()` | Transaction timestamp |

---

### 3. StockBatch (`stock_batches`)
Purchased batches of inventory. Deductions query this table to implement FIFO.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `productId` | String | FK -> `Product.id` | Reference to parent product |
| `quantity` | Int | | Remaining inventory in PET units |
| `buyPrice` | Decimal (10,2) | | Purchase cost per PET unit |
| `salePrice` | Decimal (10,2) | | Target selling price per PET unit |
| `batchNumber` | String | Unique | Manufacturer batch reference |
| `expiryDate` | DateTime | | Batch expiration date |
| `purchaseDate` | DateTime | | Date stock was purchased |
| `supplierId` | String | Nullable | Optional supplier reference |
| `supplier` | String | Nullable | Supplier name |
| `createdAt` | DateTime | Default: `now()` | Insertion timestamp |

---

### 4. StockAdjustment (`stock_adjustments`)
Audit trail of manual inventory overrides.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `batchId` | String | FK -> `StockBatch.id` | Batch adjusted |
| `quantity` | Int | | Adjustment count (negative for losses) |
| `reason` | `AdjustmentReason` (Enum)| | Reason: `damage`, `theft`, `manual_correction` |
| `notes` | String | | Supporting details |
| `adminId` | String | FK -> `User.id` | Admin who authorized adjustment |
| `createdAt` | DateTime | Default: `now()` | Transaction timestamp |

---

### 5. Retailer (`retailers`)
Customer accounts.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `shopName` | String | | Business shop name |
| `ownerName` | String | | Primary contact owner name |
| `mobileNumber` | String | | Phone number |
| `address` | String | | Delivery address |
| `deliveryLocation`| String | Nullable | GPS coords or routing notes |
| `createdAt` | DateTime | Default: `now()` | Account creation date |

---

### 6. LedgerEntry (`ledger_entries`)
Double-entry record of retailer credit mutations.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `retailerId` | String | FK -> `Retailer.id` | Retailer reference |
| `billId` | String | FK -> `Bill.id`, Nullable | Connected invoice (if applicable) |
| `entryType` | `LedgerEntryType` (Enum) | | Entry type: `sale`, `payment`, `return`, `adjustment` |
| `amount` | Decimal (12,2) | | Transaction value (positive for sales, negative for payments) |
| `balance` | Decimal (12,2) | | Retailer's net outstanding debt balance after transaction |
| `paymentMode` | `LedgerPaymentMode` (Enum) | Nullable | Payment type: `cash`, `bank_transfer`, `check` |
| `notes` | String | Nullable | Audit logs notes |
| `createdAt` | DateTime | Default: `now()` | Entry timestamp |

---

### 8. Bill (`bills`)
Finalized sales invoices.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `billNumber` | String | Unique | Standard invoice identifier |
| `retailerId` | String | FK -> `Retailer.id` | Customer reference |
| `workerId` | String | FK -> `User.id` | Worker who finalized invoice |
| `subtotal` | Decimal (12,2) | | Net sum before discounts |
| `discount` | Decimal (12,2) | Default: `0` | Discount applied to bill |
| `total` | Decimal (12,2) | | Total bill amount |
| `paidAmount` | Decimal (12,2) | Default: `0` | Upfront payment paid |
| `pendingAmount` | Decimal (12,2) | | Balance added to ledger debt |
| `paymentMode` | `BillPaymentMode` (Enum) | Nullable | Method: `cash`, `credit`, `udhar`, `generate_only` |
| `previousPendingAdded` | Decimal (12,2) | Nullable | Debt carried forward to invoice printout |
| `oldPendingPaymentApplied` | Decimal (12,2)| Nullable | Payments applied to past debt during checkout |
| `status` | `BillStatus` (Enum)| | Status: `pending`, `paid`, `partial` |
| `createdAt` | DateTime | Default: `now()` | Creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Modification timestamp |

---

### 9. BillItem (`bill_items`)
Line items nested in a finalized Bill.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `billId` | String | FK -> `Bill.id` (Cascade) | Parent bill reference |
| `productId` | String | FK -> `Product.id` | Beverage product reference |
| `quantity` | Int | | PET units purchased |
| `price` | Decimal (10,2) | | Unit price charged |
| `discount` | Decimal (10,2) | Default: `0` | Discount applied to variant |
| `total` | Decimal (12,2) | | Line total `(quantity * price) - discount` |

---

### 10. PaymentRecord (`payment_records`)
Tracks partial payments processed against specific bills.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `billId` | String | FK -> `Bill.id` (Cascade) | Parent bill reference |
| `amount` | Decimal (12,2) | | Payment amount |
| `date` | DateTime | Default: `now()` | Timestamp of payment |
| `paymentMode` | `BillPaymentMode` (Enum)| | Payment method |
| `notes` | String | Nullable | Optional notes |

---

### 11. PriceHistory (`price_history`)
Audits product default price modifications.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `productId` | String | FK -> `Product.id` | Product variant reference |
| `oldPrice` | Decimal (10,2) | | Price prior to change |
| `newPrice` | Decimal (10,2) | | Price set after change |
| `changedBy` | String | FK -> `User.id` | Admin who changed price |
| `date` | DateTime | Default: `now()` | Modification timestamp |

---

### 12. VoidedBillLog (`voided_bill_logs`)
Reconciliation log for cancelled sales transactions.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | PK, UUID | Primary Key |
| `billId` | String | FK -> `Bill.id`, Unique | Canceled bill reference |
| `workerId` | String | FK -> `User.id` | Original bill worker |
| `voidedAt` | DateTime | Default: `now()` | Void action timestamp |
| `billValue` | Decimal (12,2) | | Total value of the bill |
| `reason` | String | | Reason for deletion |

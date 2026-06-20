# Database Structure

This document outlines the complete data model for the Beverage POS System. Note that while the application currently uses a client-side Zustand store for state management, these structures serve as the definitive blueprint for the backend database integration.

## Table of Contents

- [Entity Relationship Overview](#entity-relationship-overview)
- [Users](#users)
- [Products & Stock](#products--stock)
  - [Product](#product)
  - [StockBatch](#stockbatch)
  - [StockAdjustment](#stockadjustment)
- [Retailers & CRM](#retailers--crm)
  - [Retailer](#retailer)
  - [LedgerEntry](#ledgerentry)
  - [RGBTracking](#rgbtracking)
- [Sales & Billing](#sales--billing)
  - [Bill](#bill)
  - [BillItem](#billitem)
  - [PaymentRecord](#paymentrecord)
- [Audit Logs](#audit-logs)
  - [PriceHistory](#pricehistory)
  - [VoidedBillLog](#voidedbilllog)

---

## Entity Relationship Overview

Data generally flows from **Products** and **StockBatches** into **Bills** during a sales transaction. **Bills** are inherently tied to **Retailers** and **Users** (Workers). Financial settlements on Bills trigger updates to the **Ledger** and generate **PaymentRecords**. Manual interventions or overrides generate entries in **StockAdjustments**, **PriceHistory**, or **VoidedBillLogs**.

---

## Users

### User
Represents an individual with access to the system.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `name` | String | Yes | | Full name of the user |
| `email` | String | Yes | | Unique login email |
| `role` | Enum | Yes | | Defines access level: `'admin'` or `'worker'` |
| `isActive` | Boolean | Yes | `true` | Determines if the user can log in |
| `createdAt` | DateTime | Yes | `NOW()` | Account creation timestamp |

---

## Products & Stock

### Product
Represents a sellable item within the system.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `brand` | String | Yes | | The parent brand (e.g., 'Pepsi', 'Dew') |
| `category` | Enum | Yes | | `'soft-drink'`, `'juice'`, `'water'`, `'energy-drink'` |
| `variant` | String | Yes | | Size/packaging variant (e.g., '1.5L', 'Can') |
| `petConversionFactor` | Integer | Yes | | Multiplier to convert to PET units |
| `description` | String | No | | Optional details |

### StockBatch
Represents a specific shipment of a Product received into inventory.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `productId` | String/UUID | Yes | | Foreign Key -> `Product.id` |
| `quantity` | Integer | Yes | | Current stock level in PET units |
| `buyPrice` | Decimal | Yes | | Wholesale cost per PET unit |
| `salePrice` | Decimal | Yes | | Retail price per PET unit |
| `batchNumber` | String | Yes | | Unique identifier from the supplier |
| `expiryDate` | Date | Yes | | Product expiration date |
| `purchaseDate` | Date | Yes | | Date the stock was acquired |
| `supplierId` | String/UUID | Yes | | Foreign Key -> Supplier |
| `supplier` | String | Yes | | Name of the supplier |
| `createdAt` | DateTime | Yes | `NOW()` | Record creation timestamp |

### StockAdjustment
Logs manual adjustments made to a specific StockBatch.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `batchId` | String/UUID | Yes | | Foreign Key -> `StockBatch.id` |
| `quantity` | Integer | Yes | | Amount added (positive) or removed (negative) |
| `reason` | Enum | Yes | | `'damage'`, `'theft'`, `'manual-correction'` |
| `notes` | String | Yes | | Explanation for the adjustment |
| `adminId` | String/UUID | Yes | | Foreign Key -> `User.id` (Admin who approved) |
| `createdAt` | DateTime | Yes | `NOW()` | Record creation timestamp |

---

## Retailers & CRM

### Retailer
Represents a customer/shop interacting with the wholesale business.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `shopName` | String | Yes | | Name of the retail shop |
| `ownerName` | String | Yes | | Name of the shop owner |
| `mobileNumber` | String | Yes | | Contact phone number |
| `address` | String | Yes | | Physical location of the shop |
| `deliveryLocation` | String | No | | Optional specific delivery instructions |
| `creditLimit` | Decimal | Yes | | Maximum allowable unpaid debt |
| `priceTier` | Enum | Yes | | `'standard'`, `'premium'`, `'discount'` |
| `createdAt` | DateTime | Yes | `NOW()` | Record creation timestamp |

### LedgerEntry
Records financial transactions affecting a Retailer's credit balance.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `retailerId` | String/UUID | Yes | | Foreign Key -> `Retailer.id` |
| `billId` | String/UUID | No | | Optional Foreign Key -> `Bill.id` |
| `entryType` | Enum | Yes | | `'sale'`, `'payment'`, `'return'`, `'adjustment'` |
| `amount` | Decimal | Yes | | Transaction value |
| `balance` | Decimal | Yes | | Running total balance after this entry |
| `paymentMode` | Enum | No | | `'cash'`, `'bank-transfer'`, `'check'` |
| `notes` | String | No | | Optional context |
| `createdAt` | DateTime | Yes | `NOW()` | Record creation timestamp |

### RGBTracking
Tracks the issue and return of Returnable Glass Bottles (crates).

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `retailerId` | String/UUID | Yes | | Foreign Key -> `Retailer.id` |
| `issuedQuantity` | Integer | Yes | `0` | Total crates given to the retailer |
| `returnedQuantity` | Integer | Yes | `0` | Total crates given back by the retailer |
| `balance` | Integer | Yes | `0` | `issuedQuantity - returnedQuantity` |
| `lastUpdated` | DateTime | Yes | `NOW()` | Timestamp of last interaction |

---

## Sales & Billing

### Bill
Represents a finalized sales invoice.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `billNumber` | String | Yes | | Unique human-readable invoice identifier |
| `retailerId` | String/UUID | Yes | | Foreign Key -> `Retailer.id` |
| `workerId` | String/UUID | Yes | | Foreign Key -> `User.id` (Worker who billed) |
| `subtotal` | Decimal | Yes | | Total before discounts |
| `discount` | Decimal | No | | Applied total discount |
| `total` | Decimal | Yes | | Final bill value |
| `paidAmount` | Decimal | Yes | | Amount paid upfront during creation |
| `pendingAmount` | Decimal | Yes | | Remaining amount owed (goes to ledger) |
| `paymentMode` | Enum | No | | `'cash'`, `'credit'`, `'udhar'`, `'generate-only'` |
| `status` | Enum | Yes | | `'pending'`, `'paid'`, `'partial'` |
| `createdAt` | DateTime | Yes | `NOW()` | Invoice creation timestamp |
| `updatedAt` | DateTime | Yes | `NOW()` | Last modification timestamp |

### BillItem
Represents individual product lines within a Bill.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `productId` | String/UUID | Yes | | Foreign Key -> `Product.id` |
| `quantity` | Integer | Yes | | Volume purchased in PET units |
| `price` | Decimal | Yes | | Unit price charged |
| `discount` | Decimal | No | | Line-item specific discount |
| `total` | Decimal | Yes | | `(quantity * price) - discount` |

### PaymentRecord
Logs historical partial or full payments applied against a Bill.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `amount` | Decimal | Yes | | Value of the payment |
| `date` | DateTime | Yes | `NOW()` | Timestamp of payment |
| `paymentMode` | Enum | Yes | | `'cash'`, `'credit'`, `'udhar'`, `'generate-only'` |
| `notes` | String | No | | Optional context |

---

## Audit Logs

### PriceHistory
Logs when an Admin alters the default wholesale or retail price of a Product.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `productId` | String/UUID | Yes | | Foreign Key -> `Product.id` |
| `oldPrice` | Decimal | Yes | | Previous price |
| `newPrice` | Decimal | Yes | | Updated price |
| `changedBy` | String/UUID | Yes | | Foreign Key -> `User.id` (Admin) |
| `date` | DateTime | Yes | `NOW()` | Timestamp of modification |

### VoidedBillLog
Logs when a finalized Bill is cancelled by an Admin.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | String/UUID | Yes | | Primary Key |
| `billId` | String/UUID | Yes | | Associated Bill ID (soft deleted) |
| `workerId` | String/UUID | Yes | | Foreign Key -> `User.id` (Worker who originally billed) |
| `voidedAt` | DateTime | Yes | `NOW()` | Timestamp of cancellation |
| `billValue` | Decimal | Yes | | The total value of the cancelled bill |
| `reason` | String | Yes | | Required explanation for the cancellation |

# Product Features Matrix

This document provides a comprehensive list of all functional features implemented in the Beverage POS System. Features are organized by module for easy reference.

---

## Authentication & Access Control

### 🔐 JWT-Based Authentication
- **Secure Token Lifecycle:** Implements dual-token JWT login.
  - **Access Token:** Short-lived (15 minutes) token returned in JSON response payload.
  - **Refresh Token:** Long-lived (7 days) token stored in a secure, `httpOnly`, same-site cookie.
- **Silent Re-Authentication:** The frontend interceptor automatically catches 401 errors, calls the refresh endpoint (`/api/auth/refresh`) using the HTTP cookie, updates the access token, and retries the original request without user interruption.
- **Safe Session Revocation:** Standard logout endpoint clears the refresh token cookie on the backend.

### 🛡️ Role-Based Access Control (RBAC)
- **Role Privileges:** User sessions carry one of two roles, validated server-side for every API action:
  - **Admin Access:** Full permission across inventory adjustments, reports, catalogs, CRM, and void operations.
  - **Worker Access:** Restricted exclusively to the Sales page. Unauthorized route queries yield 403 Forbidden responses.
- **UI Route Protection:** Client-side routing automatically redirects workers and admins to their respective views (e.g., workers are blocked from accessing `/admin/*`).

---

## Worker Module (Sales & Billing)

### 🖱️ Brand-First Selection
- **Brand Cards:** Interactive visual grid displaying parent brands (`Pepsi`, `Dew`, `Fanta`, etc.) using high-contrast logos in `public/images/`.
- **Variant Drill-Down:** Selecting a brand filters and displays its variants (e.g., `1.5L`, `Can`, `Glass Bottle (RGB)`) in a nested grid for rapid selection.

### 🛒 Cart & Pricing Engine
- **Calculations:** Real-time calculation of subtotal, applied item/cart discounts, and total values.
- **Price Overrides:** Workers can manually overwrite unit pricing during checkout. This triggers price variance tracking rules.
- **Print Preview Invoice:** Displays formatted invoices ready for print margins, appending carryover balances from the retailer's ledger.

---

## Admin Dashboard

### 📈 Real-Time KPIs
- **Metrics Grid:** Instantly updates metrics from the PostgreSQL database:
  - **Today's Revenue** (Calculated from completed invoices)
  - **Active Retailers** (CRM registry count)
  - **Product Variants** (Catalog list)
  - **Total Stock in PET Units** (Aggregated inventory)

### 🚨 Live Alerts Engine
- **Low Stock Thresholds:** Flags products whose remaining batch quantities drop below standard thresholds.
- **Expiry Risk Indicators:** Warns when batches expire within 30 days, using color-coded urgency styles (Yellow / Red).
- **Credit Limit Monitor:** Flags retailers whose outstanding debt exceeds credit limits.

---

## Inventory Management

### 📦 Batch-Level Inventory
- **FIFO Batch Depletion:** System deducts inventory starting from the oldest active stock batch, reducing expiry shrinkage.
- **Manual Adjustments:** Interface for receiving new batches and recording supplier info, buy/sale prices, and expiry dates.
- **Deduction Auditing:** Admin-only adjustments require selection of a standardized code (`damage`, `theft`, `manual_correction`) and a mandatory text log.

---

## Retailer CRM

### 👥 Profiles & pricing
- **Retailer Profile:** Shop name, owner name, contact number, address, and special delivery directions.
- **Pricing Tiers:** Supports distinct price lists (`standard`, `premium`, `discount`) linked to profiles, serving as default rates during billing.

### 💰 Ledger & Credit Checks
- **Credit Limits:** Outstanding balances are capped. Attempts to check out invoices that raise total debt past a retailer's credit limit are blocked.
- **Automatic Double-Entry Ledger:** Bill creations and payment logs automatically write matching debits and credits to the retailer ledger table, ensuring balances balance.
- **RGB Crate Tracker:** Independently tracks returnable glass crates (`issuedQuantity`, `returnedQuantity`, `balance`) to balance container assets separately from cash transactions.

---

## Reporting & Analytics

### 📊 Audit Reports
- **Sales Trends:** Renders sales performance aggregated by daily, weekly, monthly, or yearly scales.
- **Worker Performance:** Tracks bill totals, average order value, and worker accountability metrics.
- **Price Variance Report:** Lists invoices featuring manually overridden item prices that fall below default catalog list rates, showing worker name, variance amount, and date.
- **Voided Bills Log:** Displays soft-deleted invoices, preserving the original worker, value, date, and admin void reasoning.
- **Credit Outstanding Report:** Tabulates all outstanding balances across the retailer network.
- **CSV Data Exporter:** Integrated endpoints ready to compile query responses for download.

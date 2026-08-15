# Product Features Matrix

This document provides a comprehensive list of all functional features implemented in the Beverage POS System. Features are organized by module for easy reference.

---

## Authentication & Access Control

### 🔐 JWT-Based Authentication & Session Security
- **Secure Token Lifecycle:** Implements dual-token JWT login.
  - **Access Token:** 12-hour lifespan (`JWT_ACCESS_EXPIRES_IN=12h`) returned in JSON response payload.
  - **Refresh Token:** 10-hour lifespan (`JWT_REFRESH_EXPIRES_IN=10h`) stored in a secure, `httpOnly`, same-site cookie with dynamic `maxAge`.
- **Graceful Session Expiry Handling:** The frontend interceptor catches 401 errors and attempts silent renewal. If the refresh token is also expired, it dispatches a `session-expired` CustomEvent, opening a non-disruptive, backdrop-blurred `SessionExpiredModal` with SPA React Router navigation to `/login` — preserving in-memory cart state without abrupt page reloads.
- **Shared-PC Inactivity Auto-Logout:** An `InactivityTimer` tracks user activity (mouse, keyboard, touch, scroll) and automatically triggers the session-expired modal after 15 minutes of inactivity on shared shop PCs.
- **Shift-End Security Warning:** Desktop and mobile sidebars display a clear security reminder (*"Leaving your shift? Log out so noone can use your account."*) above the Logout button.
- **Safe Session Revocation:** Logout calls backend `/api/auth/logout` clearing the `httpOnly` cookie before clearing local storage.

### 🛡️ Role-Based Access Control (RBAC)
- **Role Privileges:** User sessions carry one of two roles, validated server-side for every API action:
  - **Admin Access:** Full permission across inventory adjustments, reports, catalogs, CRM, expenses, and void operations.
  - **Worker Access:** Restricted to Sales billing and RGB crate exchange screens. Unauthorized route queries yield 403 Forbidden responses.
- **UI Route Protection:** Client-side routing automatically redirects workers and admins to their respective views (e.g., workers are blocked from accessing `/admin/*`).

---

## Returnable Glass Bottles (RGB) Crate Management

### 🍾 Itemized Crate Tracking System
- **Warehouse Crate Stock:** Manages empty crate inventory in warehouse stock (`RGBItem`: e.g. "Coca Cola RGB", "Pepsi RGB").
- **Retailer Crate Debt Balances:** Tracks itemized crate balances per retailer (`RGBRetailerBalance`: `balance > 0` indicates retailer owes crates back).
- **Atomic Crate Exchanges:** Issue and return actions modify warehouse stock and retailer crate balances in atomic PostgreSQL transactions, recording audit logs (`RGBTransaction`).
- **Standalone & Mixed-Bill Support:**
  - **Mixed Bills:** Product sales combined with crate exchanges attach the generated `billId` to the RGB transactions.
  - **Standalone Exchanges:** Crate-only issues/returns (empty cart) log RGB transactions directly without creating a `Bill` record.
- **Dedicated RGB Views:**
  - **Inventory Page:** View Crates panel for managing crate stock and item definitions.
  - **Create Sale Page:** "RGB History" tab showing retailer crate balances, standalone issue/return buttons, and audit logs.
  - **Admin Bills Page:** "RGB Bills" tab rendering a dedicated RGB Transaction History table (Date, Retailer, RGB Item, Type, Quantity, Worker, Bill Link).

---

## Worker Module (Sales & Billing)

### 🖱️ Brand-First Selection
- **Brand Cards:** Interactive visual grid displaying parent brands (`Pepsi`, `Dew`, `Fanta`, etc.) using high-contrast logos.
- **Variant Drill-Down:** Selecting a brand filters and displays its packaging variants (e.g., `1.5L PET`, `500ml PET`, `250ml Glass`) in a nested grid for rapid selection.

### 🛒 Cart & Pricing Engine
- **Calculations:** Real-time calculation of subtotal, applied item/cart discounts, and total values.
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

---

## Inventory Management

### 📦 Batch-Level Inventory
- **FIFO Batch Depletion:** System deducts inventory starting from the oldest active stock batch, reducing expiry shrinkage.
- **Manual Adjustments:** Interface for receiving new batches and recording supplier info, buy/sale prices, and expiry dates.
- **Deduction Auditing:** Admin-only adjustments require selection of a standardized code (`damage`, `theft`, `manual_correction`) and a mandatory text log.
- **Streamlined Catalog Entry:** Product variant creation and editing focuses on variant name and description; category defaults automatically to `'general'`.

---

## Retailer CRM

### 👥 Profiles & Accounting
- **Retailer Profile:** Shop name, owner name, contact number, address, and delivery location notes.
- **Dedicated Retailer Detail View:** View page (`/admin/retailers/:id`) featuring complete shop details, total outstanding debt, itemized RGB bottle balances, and paginated double-entry financial ledger statement with controls.
- **Edit Retailer Profile Modal:** Interactive pop-up modal on the detail view for editing shop details, owner info, contact info, and delivery locations with live validation.
- **Automatic Double-Entry Ledger:** Bill creations and payment logs automatically write matching debits and credits to the retailer ledger table, tracking outstanding debt cleanly.

---

## Reporting & Analytics

### 📊 Audit Reports
- **Sales Trends:** Renders sales performance aggregated by daily, weekly, monthly, or yearly scales.
- **Worker Performance:** Tracks bill totals, average order value, and worker accountability metrics.
- **Price Variance Report:** Lists invoices featuring manually overridden item prices that fall below default catalog list rates, showing worker name, variance amount, and date.
- **Voided Bills Log:** Displays soft-deleted invoices, preserving the original worker, value, date, and admin void reasoning.
- **Credit Outstanding Report:** Tabulates all outstanding balances across the retailer network.
- **CSV Data Exporter:** Integrated endpoints ready to compile query responses for download.

# Features

This document provides a comprehensive list of all functional features currently implemented in the Beverage POS System. Features are organized by module for easy reference.

## Table of Contents

- [Authentication & Access Control](#authentication--access-control)
- [Worker Module (Sales & Billing)](#worker-module-sales--billing)
- [Admin Dashboard](#admin-dashboard)
- [Inventory Management](#inventory-management)
- [Retailer Management (CRM)](#retailer-management-crm)
- [Reporting & Analytics](#reporting--analytics)

---

## Authentication & Access Control

### Role-Based Access
- **Admin Access:** Full system access including dashboards, inventory management, retailer CRM, and all reports.
- **Worker Access:** Restricted access strictly to the Sales Billing interface. Workers cannot view reports, alter global inventory outside of sales, or manage retailer profiles.
- **Protected Routes:** Unauthorized users are automatically redirected to the login screen. Attempting to access admin-only routes as a worker redirects to the appropriate worker interface.

*Limitations:* Currently uses local session management without a connected backend for token validation.

---

## Worker Module (Sales & Billing)

### Dynamic Product Selection
- **Brand-First Navigation:** Products are organized primarily by brand using a visual, image-centric card interface.
- **Variant Drill-Down:** Clicking a brand reveals all available size variants and packaging types (e.g., RGB vs. Trays) for that specific brand.

### Shopping Cart Management
- **Quantity Input:** Workers can input specific quantities for each product variant to be added to the cart.
- **Real-Time Calculation:** The cart automatically calculates the subtotal, applies any manual discounts, and computes the final total.
- **Price Override:** Workers have the ability to manually override the selling price of an item during checkout. *(Note: This triggers a price variance audit rule for Admins).*

### Bill Finalization
- **Payment Handling:** Supports multiple payment modes, allowing workers to record the amount paid upfront versus the amount left pending (Udhari).
- **Print Preview:** Generates a summary view of the final bill suitable for printing before finalizing the transaction.

---

## Admin Dashboard

### Real-Time Metrics
- **KPI Cards:** Displays high-level statistics including Today's Sales, Total Retailers, Active Products, and Total Stock measured in PET units.

### Alert System
- **Low Stock Warnings:** Automatically flags products that have fallen below their minimum stock thresholds.
- **Expiry Risk Alerts:** Highlights stock batches that are approaching their expiration dates using color-coded urgency indicators.
- **Credit Limit Alerts:** Warns when specific retailers are approaching or have exceeded their predefined credit limits.

### Activity Feed
- **Recent Bills Log:** A real-time scrolling table showing the most recent transactions processed by workers.

---

## Inventory Management

### Stock Tracking
- **Batch Management:** Inventory is tracked by distinct batches, ensuring accurate tracking of purchase dates and expiry dates.
- **FIFO Readiness:** Stock batches are organized to support First-In-First-Out sales processing.
- **PET Unit Standardization:** All liquid stock is standardized and displayed in "Bottle Equivalent" (PET) units for consistent volume tracking regardless of packaging size.

### Stock Adjustments
- **Add Stock:** Interface for receiving new shipments, recording supplier details, purchase price, selling price, and batch expiry.
- **Manual Adjustments:** Ability to manually deduct stock, requiring a specified reason (e.g., Damage, Theft, Manual Correction) to maintain accurate audit logs.

---

## Retailer Management (CRM)

### Retailer Profiles
- **Basic Details:** Stores shop name, owner name, mobile number, and delivery address.
- **Pricing Tiers:** Retailers can be assigned to different pricing tiers (Standard, Premium, Discount) which can influence default billing rates.

### Credit & Ledger Tracking
- **Credit Limits:** Each retailer has a defined maximum credit limit. Visual progress bars indicate their current credit utilization.
- **Outstanding Balances:** Automatically tracks how much money the retailer owes based on unpaid or partially paid bills.
- **Ledger Integration:** A historical record of all transactions (sales, payments, returns) affecting the retailer's balance.

### Crate (RGB) Management
- **Empty Crate Tracking:** Dedicated tracking for Returnable Glass Bottles (RGB) and crates, recording how many crates have been issued to a retailer versus how many have been returned.

---

## Reporting & Analytics

### Sales Analytics
- **Trend Reports:** View sales performance aggregated by daily, weekly, monthly, or yearly periods.

### Performance Tracking
- **Product Performance:** Identifies fast-moving versus slow-moving products to inform purchasing decisions.
- **Worker Accountability:** Tracks the volume of sales processed by individual workers, including any discounts applied.

### Audit & Compliance
- **Price Variance Detection:** Automatically generates a report flagging any instances where a worker sold a product below its designated default price.
- **Voided Bills Log:** Maintains a secure audit trail of any bills that have been cancelled or voided by an Admin.
- **Credit Report:** Comprehensive view of all outstanding debts across the entire retailer network.

*Limitations:* Export to CSV functionality is structurally prepared but currently serves as a framework pending backend integration.

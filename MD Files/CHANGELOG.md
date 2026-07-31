# Changelog

All notable changes to the Beverage POS System are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

---

## Table of Contents
- [[2.3.0] - 2026-07-17](#230---2026-07-17)
- [[2.2.0] - 2026-07-08](#220---2026-07-08)
- [[2.1.0] - 2026-06-30](#210---2026-06-30)
- [[2.0.0] - 2026-06-26](#200---2026-06-26)
- [[1.1.0] - 2026-06-19](#110---2026-06-19)
- [[1.0.0] - 2026-02-19](#100---2026-02-19)

---

## [2.3.0] - 2026-07-17

### Added
- **Brand Name Normalization on Sales Page**: Grouped and sorted product variants on the worker `SalesPage` brand grid using the database-level brand relation display names (`p.brandRel?.displayName ?? p.brand`). This correctly merges casing discrepancies like "coca cola" and "Coca Cola" or "sprite" and "Sprite" into unified brand buttons, aligning the Create Sale screen with the 4 core brands shown in the Inventory Page.
- **Unified Brand Image Lookup**: Synced worker `SalesPage` brand buttons and cards to use the brand-scoped image path (`brandRel.imageUrl`) for rendering, with fallbacks to legacy product images.

### Changed
- **Database Catalog Soft-Delete Alignment**: Successfully soft-deleted duplicate manually created 0-stock products (e.g. lowercase `sprite 500ml`, `sprite 1.5l`, `coca cola 2l`, and `coca cola 1.5l`) in the database. Because these items now correctly return `isActive: false`, they are hidden from all worker sales lists and inventory pages.
- **Sales Page Stepper and Typos Fix**: Updated local `PaymentMethod` types in `SalesPage.tsx` from `generate_only` to `generate-only` to resolve TypeScript compilation mismatch with the global `Bill` schema type definitions.
- **Inventory Page Code Cleanup**: Removed the unused state `brandsLoading` and its corresponding setter calls from `InventoryPage.tsx` to keep compilation clean.

## [2.2.0] - 2026-07-08

### Added
- **Product Image Upload Support**: Integrated `multer` on the backend for saving JPEG, PNG, and WebP product images (up to 2MB) locally to `/uploads/products/` and serving them statically.
- **Dynamic Images on Frontend**: Implemented dynamic product image displaying on `InventoryPage` and `SalesPage` variants instead of a hardcoded image map.
- **Database-Backed RGB Tracking**: Added a PostgreSQL model `RGBVariety` for storing and managing returnable glass bottle inventory in the database, replacing the previous unstable localStorage implementation.
- **React Portal Modal Component**: Rebuilt the common `Modal` component utilizing React Portals (`createPortal`), escape key listeners, click-outside closures, focus trapping/restoration, and body scroll lock for a fully responsive, bug-free UX.
- **Dynamic Category Selection**: Added a free-text category selection system with dynamic suggestion chips in the Create Product modal.

### Changed
- **Removed PET Conversion Multipliers**: Completely deleted the `petConversionFactor` logic, schema columns, types, and variables across the frontend and backend. All products are now sold and tracked by their packaging variant unit directly.
- **Prisma Schema Migration**: Generalised the `category` column to a free-text `String` type and dropped the restrictive `ProductCategory` enum.
- **Zustand Store Expansion**: Synced the new DB-backed `rgbVarieties` state with the backend via a new frontend `rgbService` client.

## [2.1.0] - 2026-06-30

### Added
- **Branding Personalization**: Rebranded the POS system to "AbdulHaq" across all user-facing headers, layouts, page titles, login page, and text receipt templates.
- **Inventory Seeding Script**: Created a database seeding script (`seed_products.ts`) to easily populate new products and batches.
- **Marinda Product Support**: Added `Marinda` (Mirinda) brand with support for image rendering and Returnable Glass Bottles (RGB) quick action logic.
- **Beverage Catalog Expansion**: Added Coca Cola, Sprite, Marinda, and Dew brands with four standard packaging variants each:
  - 250ml Glass (24 conversion factor)
  - 500ml PET (12 conversion factor)
  - 1.5L PET (6 conversion factor)
  - 2.25L PET (6 conversion factor)
- **Initial Inventory Stock**: Automatically seeded initial FIFO stock batches of **100 cases (PET units)** for all 16 new product variant combinations.
- **Product Assets**: Generated and added high-quality `marinda.png` to static assets (`public/images/`).

---

## [2.0.0] - 2026-06-26

### Added
- **Full-Stack Architecture Support**: Shifted application from client-only mock data to a fully integrated backend architecture.
- **Express API Server**: Initialized Node.js, Express, and TypeScript API service layers under `/backend`.
- **Database Engine (PostgreSQL & Prisma)**: Implemented Prisma ORM version 5, establishing a robust database layer on PostgreSQL with a 13-model schema (`User`, `Product`, `StockBatch`, `StockAdjustment`, `Retailer`, `LedgerEntry`, `RGBTracking`, `Bill`, `BillItem`, `PaymentRecord`, `PriceHistory`, `VoidedBillLog`).
- **Secure JWT Authentication**: Implemented stateless access token (15-minute lifespan) and refresh token (7-day lifespan via `httpOnly` secure cookies) authentication.
- **Role-Based Access Control (RBAC)**: Added authentication and role verification middleware (`auth.ts` and `requireRole.ts`) to secure endpoints.
- **Products API Module**: Created CRUD routes for products, supporting product catalogs and in-stock inventory queries.
- **Inventory API Module**: Created FIFO stock batch tracking, low-stock notifications, expiry warnings, and manual stock adjustment logging with audit logs.
- **Retailer & CRM API Module**: Configured database storage for profiles, pricing tiers, and direct ledger mappings.
- **Empty Crate (RGB) API**: Integrated Returnable Glass Bottle tracking independently of monetary transactions in the backend services.
- **Atomic Sales Transaction Engine**: Added invoice creation logic. It dynamically verifies credit, deducts inventory via FIFO across batches, checks for price overrides, creates ledger debit records, and commits transactionally (fails or succeeds as a single unit).
- **Credit Enforcement Engine**: Server-side enforcement of retailer credit ceilings (warning at 70%, block at 100%).
- **Voided Bill Auditing**: Created soft-delete logic for bills, writing reversing ledger logs and storing audit reasons for security compliance.
- **Ledger & direct Payments API**: Created routes for posting direct payments and auditing historical retailer ledgers.
- **Database Seeding**: Created `prisma/seed.ts` script to populate database with default configurations, products, and default `admin@pos.com / admin123` and `worker@pos.com / worker123` credentials.

### Changed
- **Directory Structure**: Structured project into a monorepo consisting of frontend (`/src`) and backend (`/backend`).
- **Configuration Templates**: Created `.env.example` configurations containing safe database templates and token expiration defaults.

---

## [1.1.0] - 2026-06-19

### Added
- **Image-Centric Product Cards**: Integrated brand logos (`pepsi.png`, `dew.png`, `fanta.png`, etc.) into `public/images/` and applied them to the primary product selection screens.
- **Brand-First Navigation**: Introduced a two-tier drill-down UI for product selection. Workers now select a Brand card first before selecting specific size/packaging variants.

### Changed
- **Inventory Page UI**: Synchronized the `InventoryPage` product grid to match the new image-centric layout of the `SalesPage`.
- **Documentation Overhaul**: Extensively updated and corrected `PROJECT_SUMMARY.md`, `ARCHITECTURE.md`, `GETTING_STARTED.md`, and `FILES_LISTING.md` to resolve redundancies and accurately reflect the lack of an existing backend service layer.

### Removed
- **Duplicate Crate Entries**: Removed redundant "Tray (12 Bottles)" entries from the root Empty Crates (RGB) view. These are now properly nested as sub-variants under their respective parent brands (Pepsi, Coca Cola, Sprite).
- **Dead Code**: Cleaned up disabled JSX grids in `SalesPage.tsx` that contained TypeScript errors.

---

## [1.0.0] - 2026-02-19

### Added
- **Initial Release**: Stabilized the core POS functionality.
- **Worker Module**: Created the primary Sales Billing interface with real-time cart calculations and PET unit standardization.
- **Admin Dashboard**: Added real-time metric cards, low-stock alerts, and recent bill activity tracking.
- **Inventory System**: Implemented batch-based stock tracking with expiry monitoring.
- **Retailer CRM**: Added comprehensive retailer profiles, credit limit monitoring, and automated ledger integration.
- **Reporting Engine**: Created foundational reports for Sales, Product Performance, Worker Accountability, and Price Variance detection.
- **State Management**: Implemented Zustand for global state using robust mock data arrays pending API integration.
- **Core Documentation**: Initialized `README.md`, `ARCHITECTURE.md`, and backend `API_INTEGRATION.md` guides.

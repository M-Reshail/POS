# Changelog

All notable changes to the Beverage POS System are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

---

## Table of Contents
- [[2.0.0] - 2026-06-26](#200---2026-06-26)
- [[1.1.0] - 2026-06-19](#110---2026-06-19)
- [[1.0.0] - 2026-02-19](#100---2026-02-19)

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

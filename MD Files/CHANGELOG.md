# Changelog

All notable changes to the Beverage POS System are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

---

## Table of Contents
- [[2.7.0] - 2026-08-15](#270---2026-08-15)
- [[2.6.0] - 2026-08-14](#260---2026-08-14)
- [[2.5.0] - 2026-08-14](#250---2026-08-14)
- [[2.4.0] - 2026-08-13](#240---2026-08-13)
- [[2.3.0] - 2026-07-17](#230---2026-07-17)
- [[2.2.0] - 2026-07-08](#220---2026-07-08)
- [[2.1.0] - 2026-06-30](#210---2026-06-30)
- [[2.0.0] - 2026-06-26](#200---2026-06-26)
- [[1.1.0] - 2026-06-19](#110---2026-06-19)
- [[1.0.0] - 2026-02-19](#100---2026-02-19)

---

## [2.7.0] - 2026-08-15

### Added
- **Dedicated Retailer Profile & Financial Ledger View**: Clicking "View" on any retailer profile now opens a dedicated Retailer Detail dashboard. This view displays overall shop details, total outstanding debt, itemized empty bottle/crate balances, and a full double-entry financial ledger statement with page-by-page navigation.
- **Edit Retailer Profile Modal**: Added an interactive pop-up form on the Retailer Detail view allowing administrators to edit and update retailer contact details, shop names, owner information, and delivery locations with instant validation.

### Fixed
- **Automatic High-Precision Number Formatting**: Fixed an issue where monetary amounts and high-precision numbers returned by the server were being treated as text strings instead of numeric values. The central server response system now automatically formats all numeric fields, ensuring clean financial displays and calculations throughout the system.
- **Sales Bill Linkage for Returned Bottles**: Fixed an issue where empty bottles or crates returned by retailers during a checkout sale were not being linked to the resulting sales bill. Bottle returns during checkout sales are now directly tied to their parent bill statement.
- **Double-Submission Prevention on Checkout**: Resolved a bug on the worker checkout page where rapidly double-clicking the complete sale button could generate duplicate bill records in the database. A submission lock now immediately blocks redundant clicks while an invoice is processing.
- **Admin Bills Sorting, Pagination, and Bottle Display**: Corrected list ordering on the Admin Bills page so newest bills appear first rather than last, introduced an incremental "Load More" button to view historical bills beyond initial caps, and grouped bottle give and return actions into a single consolidated row per sale.
- **Full Expenses History & Direct Server Filters**: Fixed the Expenses management view so all historical expenses load by default instead of restricting display to the active period, and ensured custom date range filters query the server database directly to pull complete historical expense records.

---

## [2.6.0] - 2026-08-14

### Added
- **Preset Revenue Cards & Auto-Expanded Period View**: Configured `AdminBillsPage.tsx` to compute Today, This Week, and This Month preset revenue cards from the complete bill dataset on initial page load. Clicking any period preset card (**Today**, **This Week**, **This Month**) automatically expands and displays ALL bills matching that period (bypassing the 10-item display limit). Deselecting the card restores the 10-item paginated view with the "Load More Bills" button.
- **Single-Bill Creation for RGB-Only Sales**: Updated `createBill` in `bill.service.ts` so all checkout sales (whether product-only, mixed, or RGB-only crate exchanges) generate a single unified `Bill` record with `total: 0` and `status: 'paid'`, linking both crate issue (`ISSUE`) and return (`RETURN`) transactions to `saleId: bill.id`.
- **Grouped RGB History View on Worker Site**: Implemented memoized grouping (`groupedWorkerRgbHistory`) in `SalesPage.tsx` so sales with dual crate exchanges (Give and Return) display as a single combined row with `Given ↓ X` and `Returned ↑ Y` badges under `Linked to Sale`, matching the admin view.

### Changed
- **High-Contrast Grey Theme & Outlines**: Standardized global styling in `index.css`, `Layout`, `Modal`, and `RetailerDetailPage` to feature a medium grey background (`bg-gray-200/80`), crisp white card containers (`bg-white`), and defined outline borders (`border border-gray-300`).
- **Expenses Page Direct Backend Querying**: Initialized `period` state to `null` by default on `ExpensesPage.tsx` to load full historical expense records newest-first. Presets ('Today', 'This Week', 'This Month') now trigger fresh date-bounded backend queries (`expensesService.getAll({ dateFrom, dateTo })`) and act as toggle buttons.
- **Dynamic Category Charts**: Rebound Bar Chart and Pie Chart in `ExpensesPage.tsx` to dynamically recalculate category breakdown totals from the active filtered expense dataset.

### Fixed
- **RGB Return `saleId` Link**: Added `saleId?: string` to `ReturnRGBInput` in `rgb.service.ts` and updated `createBill` in `bill.service.ts` to pass `saleId: bill.id` to `returnRGB()`, preventing crate return legs from becoming orphaned/unlinked.
- **Worker Sales Double-Submission Guard**: Added a synchronous `isSubmittingRef = useRef(false)` guard at the start of `handleCreateBill()` in `SalesPage.tsx` to prevent rapid double-clicks from creating duplicate bill records.
- **Admin Bills Sort Order**: Removed `.reverse()` from `filteredBills` in `AdminBillsPage.tsx` to preserve the backend's native newest-to-oldest (`createdAt desc`) order.
- **Admin Bills Grouped RGB Rows**: Grouped `filteredRgbTransactions` by `saleId` + `rgbItemId` so Give and Return legs of a sale render as a single combined row linked to the parent bill.

---

### Added
- **Retailer Detail Page**: Built a dedicated `/admin/retailers/:id` page featuring shop profile info, net outstanding debt, RGB balances, and paginated double-entry ledger audit statement table with full pagination controls.
- **Wired Retailer Navigation**: Connected the "View" button in `RetailersPage.tsx` table to navigate to `/admin/retailers/:id`.

### Fixed
- **Central Prisma Decimal Serialization**: Added recursive `serializeDecimals` in `backend/src/lib/response.ts` to convert all `Prisma.Decimal` instances to native JS numbers in `ok()`, `created()`, and `badRequest()` response envelopes, preventing string concatenation bugs on the frontend.
- **Role-Scoped Shift-End Reminder**: Updated `Layout/index.tsx` so the shift-end logout warning (*"Leaving your shift? Log out so noone can use your account."*) only displays for worker accounts and is hidden for admins.

---

## [2.4.0] - 2026-08-13

### Added
- **Multi-Worker Shared PC Session Security**: Implemented a 15-minute frontend `InactivityTimer` that automatically dispatches a `session-expired` CustomEvent when no user input (mouse, keyboard, touch, scroll) is detected.
- **Graceful Session Expired Modal**: Replaced abrupt `window.location.href` browser reloads with a backdrop-blurred `SessionExpiredModal` in `App.tsx` featuring smooth SPA React Router navigation to `/login`.
- **Shift-End Logout Warning**: Added a prominent security reminder above the Logout button in both desktop and mobile sidebars (*"Leaving your shift? Log out so noone can use your account."*).
- **RGB Transaction Table in Admin Bills**: Replaced generic product bill columns in the Admin Bills page "RGB Bills" tab with a dedicated RGB Transaction History table (Date, Retailer, RGB Item, Type, Quantity, Worker, Bill Link).

### Changed
- **Extended Token Lifetime**: Configured access token lifetime to 12 hours (`JWT_ACCESS_EXPIRES_IN=12h`) and refresh token lifetime to 10 hours (`JWT_REFRESH_EXPIRES_IN=10h`).
- **Dynamic Cookie Lifetime**: Updated backend `auth.controller.ts` to calculate cookie `maxAge` dynamically from `env.JWT_REFRESH_EXPIRES_IN` rather than using a hardcoded 7-day duration.
- **Retailer Feature Refactoring**: Completely removed `creditLimit`, `priceTier`, and `creditStatus` fields from Prisma schema, backend controllers/services, ledger logic, and frontend types/forms. Removed the `PriceTier` enum and credit limit check logic.
- **Simplified Product Creation**: Removed the redundant Category selection dropdown and suggestions from Add Variant and Edit Variant modals in `InventoryPage.tsx`. Category in backend schema now defaults to `'general'`.
- **Sidebar Layout Fix**: Made the sidebar navigation container scrollable (`overflow-y-auto`) and pinned the user info & logout footer (`flex-shrink-0`), preventing the Logout button from overflowing out of the viewport on lower-height screens.

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

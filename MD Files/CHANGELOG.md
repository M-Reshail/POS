# Changelog

All notable changes to the Beverage POS System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

*(Note: History prior to v1.0.0 is unavailable as the repository's early git history was not preserved. Documentation begins from the stabilized v1.0.0 release).*

## Table of Contents
- [[1.1.0] - 2026-06-19](#110---2026-06-19)
- [[1.0.0] - 2026-02-19](#100---2026-02-19)

---

## [1.1.0] - 2026-06-19

### Added
- **Image-Centric Product Cards:** Integrated brand logos (`pepsi.png`, `dew.png`, `fanta.png`, etc.) into `public/images/` and applied them to the primary product selection screens.
- **Brand-First Navigation:** Introduced a two-tier drill-down UI for product selection. Workers now select a Brand card first before selecting specific size/packaging variants.

### Changed
- **Inventory Page UI:** Synchronized the `InventoryPage` product grid to match the new image-centric layout of the `SalesPage`.
- **Documentation Overhaul:** Extensively updated and corrected `PROJECT_SUMMARY.md`, `ARCHITECTURE.md`, `GETTING_STARTED.md`, and `FILES_LISTING.md` to resolve redundancies and accurately reflect the lack of an existing backend service layer.

### Removed
- **Duplicate Crate Entries:** Removed redundant "Tray (12 Bottles)" entries from the root Empty Crates (RGB) view. These are now properly nested as sub-variants under their respective parent brands (Pepsi, Coca Cola, Sprite).
- **Dead Code:** Cleaned up disabled JSX grids in `SalesPage.tsx` that contained TypeScript errors.

---

## [1.0.0] - 2026-02-19

### Added
- **Initial Release:** Stabilized the core POS functionality.
- **Worker Module:** Created the primary Sales Billing interface with real-time cart calculations and PET unit standardization.
- **Admin Dashboard:** Added real-time metric cards, low-stock alerts, and recent bill activity tracking.
- **Inventory System:** Implemented batch-based stock tracking with expiry monitoring.
- **Retailer CRM:** Added comprehensive retailer profiles, credit limit monitoring, and automated ledger integration.
- **Reporting Engine:** Created foundational reports for Sales, Product Performance, Worker Accountability, and Price Variance detection.
- **State Management:** Implemented Zustand for global state using robust mock data arrays pending API integration.
- **Core Documentation:** Initialized `README.md`, `ARCHITECTURE.md`, and backend `API_INTEGRATION.md` guides.

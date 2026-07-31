# 📂 File Directory & Structure Documentation

This document details all files in the Beverage POS monorepo, organized by directory.

---

## 1. Project Root Directory
Contains configuration files for the React frontend application and serves as the monorepo root.

- **package.json** - Frontend dependencies (React 18, Zustand, Tailwind, Lucide Icons, React Router v6) and build scripts.
- **tsconfig.json** - Global TypeScript compiler settings.
- **tsconfig.node.json** - TypeScript config for Node tools (Vite).
- **vite.config.ts** - Vite bundling configuration.
- **tailwind.config.js** - Tailwind CSS utility configurations and custom layout colors.
- **postcss.config.js** - PostCSS wrapper for Tailwind compile.
- **index.html** - HTML entry point containing the mounting root `div`.
- **.gitignore** - Root-level exclusions (`node_modules`, `dist/`, log files).

---

## 2. Public Directory (`public/`)
Houses static assets loaded directly by the client browser.

- **public/images/** - Brand icons used on the SalesPage cards:
  - `coca-cola.png`
  - `dew.png`
  - `fanta.png`
  - `marinda.png`
  - `pepsi.png`
  - `sprite.png`
  - `string.png`

---

## 3. Frontend Source Code (`src/`)
Contains client-side React + TypeScript application source code.

- **src/main.tsx** - DOM rendering entry point.
- **src/App.tsx** - Frontend routing setup, including layout wrappers and RBAC guards.
- **src/index.css** - Global Tailwind definitions and custom CSS overrides.
- **src/types/index.ts** - Unified TypeScript interfaces representing data models.
- **src/store/index.ts** - Zustand state management store for frontend actions.

### Pages (`src/pages/`)
- **auth/LoginPage.tsx** - Dual-role login screen.
- **worker/SalesPage.tsx** - Brand-first drill-down and cart checkout panel for workers.
- **admin/AdminDashboard.tsx** - Metric summaries, inventory alerts, and real-time transaction logs.
- **admin/InventoryPage.tsx** - Batch listings, stock receipt forms, and adjustment models.
- **admin/RetailersPage.tsx** - Retailer database, credit limit bars, ledger summaries, and RGB crate tracking forms.
- **admin/ReportsPage.tsx** - Analytical reporting views (Sales, Product performance, Worker accountability, Price variance, Credit).

---

## 4. Backend Root Directory (`backend/`)
Contains the Node.js API server codebase, Prisma ORM setups, and PostgreSQL migration hooks.

- **backend/package.json** - Backend dependencies (Express, Prisma, Zod, bcrypt, jsonwebtoken, ts-node).
- **backend/tsconfig.json** - Backend TypeScript compilation settings.
- **backend/.env.example** - Blank configuration template for database URLs and secrets.
- **backend/.gitignore** - Backend-specific ignores (excluding `.env`, `node_modules`, `dist/`).
- **backend/run-seed.js** - Helper script to run the database seeder easily.

### Database Setup (`backend/prisma/`)
- **schema.prisma** - Prisma ORM database models, relations, schemas, and enums.
- **seed.ts** - Database seeder script which creates default accounts (`admin@gmail.com`, `worker@gmail.com`).
- **seed_products.ts** - Seeder script for beverage products (Coca Cola, Sprite, Marinda, Dew) and their variants/batches.

### API Source Code (`backend/src/`)
- **index.ts** - Express server entry point. Configures security middlewares, routes, error handlers, and port listeners.

#### Config (`backend/src/config/`)
- **env.ts** - Environment variable parsing and verification using Zod schemas (fails fast on startup).

#### Utilities (`backend/src/lib/`)
- **prisma.ts** - Singleton wrapper for PrismaClient to prevent connection leakage.
- **response.ts** - Express HTTP response formatting helpers.

#### TypeScript Typing (`backend/src/types/`)
- **express.d.ts** - Extends Express request interface to carry authorized user payloads.

#### Middleware (`backend/src/middleware/`)
- **auth.ts** - Decodes incoming Bearer JWT headers and validates user sessions.
- **requireRole.ts** - Middleware factory to block non-admin accounts from restricted endpoints.

#### Business Modules (`backend/src/modules/`)
Each directory contains service logics, Express routing handlers, and endpoints.
- **auth/** - User login, logout, profile checks, and token refreshes.
  - `auth.routes.ts`
  - `auth.controller.ts`
  - `auth.service.ts`
- **products/** - Catalog listings, in-stock checks, and catalog editing.
  - `product.routes.ts`
  - `product.controller.ts`
  - `product.service.ts`
- **inventory/** - Batch entry, adjustments auditing, low-stock lists, and FIFO depletions.
  - `inventory.routes.ts`
  - `inventory.controller.ts`
  - `inventory.service.ts`
- **retailers/** - Customer CRUD, ledger audits, and crate tracking.
  - `retailer.routes.ts`
  - `retailer.controller.ts`
  - `retailer.service.ts`
- **brands/** - Brand management, displayName modifications, and static image uploads.
  - `brand.routes.ts`
  - `brand.controller.ts`
  - `brand.service.ts`
- **bills/** - Invoice generation, transaction locks, pricing audits, worker logs, and soft deletions (voids).
  - `bill.routes.ts`
  - `bill.controller.ts`
  - `bill.service.ts`
- **ledger/** - Direct ledger settlements and total debt reports.
  - `ledger.routes.ts`
  - `ledger.controller.ts`
  - `ledger.service.ts`

---

## 5. Frontend Services (`src/services/`)
Communicates with the backend REST endpoints.

- **src/services/auth.ts** - Worker/Admin sign-in operations.
- **src/services/brands.ts** - Brand listing, brand creation, and brand image modification.
- **src/services/products.ts** - Variant CRUD services.
- **src/services/inventory.ts** - Stock batch additions and adjustments.
- **src/services/retailers.ts** - Retailer accounts and balance statements.
- **src/services/bills.ts** - Sales billing processing.

---

## 6. Daily Updates Directory (`Updates/`)
Holds revision logs and patch histories.

- **Updates/2026-07-17_Updates.md** - Detailed logs for brand normalization, P0 sales page crash fix, and soft-delete DB syncing.

---

## 7. Documentation Directory (`MD Files/`)
Technical guides and design documents detailing the POS.

- **README.md** - General overview, tech stack features, and quick-start instructions.
- **GETTING_STARTED.md** - Step-by-step developer tutorial for starting the frontend and backend.
- **ARCHITECTURE.md** - Core blueprints, structural diagrams, database maps, and endpoint specifications.
- **API_INTEGRATION.md** - Axio API definitions, schemas, and integration patterns.
- **Business_Rules.md** - Business restrictions, calculations, and rules.
- **Database.md** - Detailed PostgreSQL/Prisma table column tables.
- **Features.md** - Feature matrices and access control mappings.
- **FILES_LISTING.md** - This document directory.
- **UI_Guidelines.md** - Styling grids, tailwind patterns, and common components guide.
- **CHANGELOG.md** - Detailed version logs.
- **PROJECT_SUMMARY.md** - Project milestones and next steps checklist.

---

## 📊 File Statistics

```
Total Files: 72+
Total Lines of Code: ~6,500+
TypeScript Files: ~40
CSS Files: 1
Config Files: 8
Documentation Files: 12 (including daily updates)
Image Files: 7 (in public/images/)
```

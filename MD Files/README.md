# AbdulHaq Beverage POS System

A comprehensive **Wholesale & Retail Beverage Management System** built with a full-stack architecture featuring **React + Tailwind CSS** on the frontend, and **Node.js + Express + TypeScript + PostgreSQL + Prisma ORM** on the backend. Designed specifically for shopkeepers and wholesalers dealing in soft drinks, juices, water, and related FMCG products.

## 🎯 Purpose

This system prioritizes simplicity for shop workers (PC-based billing) and control/visibility for owners/admins (mobile-ready dashboard). It supports:

- ✅ **Unified Database Backend** — Centralized data persistence via PostgreSQL.
- ✅ **Inventory Batch Tracking** — FIFO (First-In-First-Out) stock depletion logic.
- ✅ **Credit (Udhari) Management** — Strict credit limit enforcement and automated ledger logging.
- ✅ **RGB Crate Tracking** — Independent tracking of Returnable Glass Bottles and plastic crates.
- ✅ **Worker Accountability** — Roles and detailed audit trails for adjustments, price overrides, and voided bills.
- ✅ **Automated Billing** — Real-time invoice calculations with print preview functionality.
- ✅ **Price Variance Flagging** — Automated detection of below-default price sales.
- ✅ **Role-Based Access Control** — Robust backend protection with JWT tokens (Access/Refresh tokens).

---

## 👥 User Roles

The system uses a single login page for both Admin and Worker accounts. Role-based privileges are verified server-side.

### Admin (Owner/Manager)
- Full read/write access to all modules and configurations.
- Access to analytical reports, profit metrics, and sales trends.
- Controls pricing, catalog CRUD, worker accounts, and stock adjustments.
- Manages retailer profiles, credit limits, and ledger entries.

### Worker (Shop/Warehouse Staff)
- Restricted PC-only sales billing screen.
- Can select products, brands, and variants to create invoices.
- Can apply manual discounts or overrides (which flags price variance audit logs).
- **Cannot:** Create/update products, modify stock levels, view reports, or edit past bills.

---

## 🏗️ Project Structure

The project is structured as a monorepo containing the React frontend at the root level and the Node.js API server in the `backend/` directory:

```
POS/                            ← Monorepo Root
├── src/                        ← Frontend Source (React + TypeScript)
│   ├── components/
│   │   ├── common/             # Reusable UI elements (Button, Input, Modal, etc.)
│   │   └── Layout/             # Main dashboard navigation container
│   ├── pages/
│   │   ├── auth/               # Single login page
│   │   ├── worker/             # Sales page for staff
│   │   └── admin/              # Dashboard, Inventory, CRM, and Reports
│   ├── store/                  # Zustand state management
│   ├── types/                  # TypeScript interface definitions
│   └── App.tsx                 # Frontend routing & Protected routes
├── public/                     ← Static Assets
│   └── images/                 # Brand logos (pepsi.png, sprite.png, etc.)
└── backend/                    ← Backend Source (Express + Prisma + PostgreSQL)
    ├── prisma/
    │   ├── schema.prisma       # Prisma data model & database schema
    │   └── seed.ts             # Database seeder (Admin & Worker default users)
    ├── src/
    │   ├── config/             # Environment validators
    │   ├── lib/                # Database singleton, response utilities
    │   ├── middleware/         # JWT parser, role validation guards
    │   ├── modules/            # Business modules (Auth, Products, Inventory, CRM, Bills, Ledger)
    │   └── index.ts            # API Server entry point
    └── package.json            # Backend scripts & dependency list
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Zustand
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 3
- **Routing**: React Router v6
- **Date Utilities**: date-fns

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express (TypeScript-native)
- **Database ORM**: Prisma v5
- **Validation**: Zod
- **Security**: JSON Web Tokens (Access + Refresh tokens), bcrypt password hashing

### Database
- **Database Engine**: PostgreSQL

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18.x or higher)
- PostgreSQL (running locally or cloud-hosted)
- npm or yarn

### 1. Backend Setup

First, initialize and configure the database and start the API server:

```bash
# Navigate to the backend directory
cd POS/backend

# Install dependencies
npm install

# Create environment file from template
cp .env.example .env
# Open .env and configure:
# - DATABASE_URL (e.g., postgresql://postgres:password@localhost:5432/beverage_pos?schema=public)
# - JWT_ACCESS_SECRET & JWT_REFRESH_SECRET (any strong secret strings)

# Push the Prisma schema to create database tables
npx prisma db push

# Seed default admin and worker users
npm run db:seed

# Start the backend development server
npm run dev
```
The backend API server will start on `http://localhost:5000`.

### 2. Frontend Setup

In a new terminal window, install frontend dependencies and start the Vite dev server:

```bash
# Navigate to the monorepo root
cd POS

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```
The application will launch in development mode, typically available at `http://localhost:5173` (with fallback to `3000`).

---

## 📝 Default Credentials

The database seeder initializes the following accounts:

### Admin Account (Full Privileges)
- **Email**: `admin@pos.com`
- **Password**: `admin123`

### Worker Account (Sales Only)
- **Email**: `worker@pos.com`
- **Password**: `worker123`

---

## 🧮 Core Business Logic Enforced

- **Direct Unit Tracking**: Products are tracked and sold directly by their variant units (e.g. 1.5L PET, 250ml Glass, Can). The deprecated `petConversionFactor` conversion logic has been removed.
- **FIFO Depletion**: Invoices deduct stock automatically starting from the oldest available stock batch of a product.
- **Credit (Udhari) Thresholds**: Retailer credit levels are calculated dynamically. Outstanding balance is capped at `100%` of credit limit; warnings are flagged at `70%` (Orange) and `90%` (Red).
- **Price Override Flags**: Sales processed below a product's standard tier price trigger an entry in the Price Variance Report.
- **Voided Bill Audit**: Finalized bills cannot be deleted. Admin cancellation triggers a soft-delete and records the reversing transaction in the database audit log.

---

**Last Updated**: July 8, 2026  
**Version**: 2.2.0  
**License**: Commercial/Educational  

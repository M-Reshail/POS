# 🚀 GETTING STARTED - Full-Stack POS System Setup

This guide will walk you through setting up and running the full-stack Beverage POS system locally.

---

## 📋 System Requirements

Ensure you have the following installed on your machine:
1. **Node.js** (v18.x or higher)
2. **PostgreSQL** (running locally or a cloud-hosted instance, e.g., on Supabase)
3. **npm** (comes with Node.js)

---

## 🛠️ Step-by-Step Setup

### Step 1: Clone and Prepare Workspace
Make sure your project directory contains the frontend files at the root level and the `backend/` directory.

### Step 2: Set Up the Backend Server & Database
Open a terminal window and navigate to the backend directory:

```bash
# 1. Navigate to the backend directory
cd POS/backend

# 2. Install backend dependencies
npm install

# 3. Create the environment configuration file
cp .env.example .env
```

Open the newly created `.env` file in your code editor and configure the variables:
- **`DATABASE_URL`**: Update this with your PostgreSQL credentials. For example:
  `DATABASE_URL="postgresql://postgres:Reshail50@localhost:5432/beverage_pos?schema=public"`
- **`JWT_ACCESS_SECRET`** & **`JWT_REFRESH_SECRET`**: Set these to any random secure strings (e.g., at least 32 characters long).
- **`PORT`**: Default is `5000` (can be changed if needed).
- **`CORS_ORIGIN`**: Set to `http://localhost:5173` (default Vite port) or `http://localhost:3000`.

Now, push the database schema and seed the initial users:

```bash
# 4. Push the Prisma database schema (creates tables in PostgreSQL)
npx prisma db push

# 5. Run the seeder script (creates admin/worker users and initial products)
npm run db:seed

# 6. Start the backend development server
npm run dev
```

You should see logs in the console confirming that the server is running on `http://localhost:5000` and waiting for database queries.

---

### Step 3: Set Up the Frontend Client
Open a **new terminal window** at the project root directory:

```bash
# 1. Navigate to the project root
cd POS

# 2. Install frontend dependencies
npm install

# 3. Create a frontend environment configuration
echo "VITE_API_URL=http://localhost:5000/api" > .env

# 4. Start the Vite dev server
npm run dev
```

The frontend will start and automatically open in your browser, typically at **`http://localhost:5173`** (or fallback to `3000`).

---

## 🎮 Testing the Application

The database seeder configures two test accounts:

### 1. Test Admin Role (Full Access)
- **Email**: `admin@pos.com`
- **Password**: `admin123`
- **Actions to Try**:
  - Review the **Admin Dashboard** showing aggregated metrics, inventory alerts, and transaction logs.
  - Manage **Inventory** by adding a new stock batch or performing manual stock adjustments with reasons.
  - Explore the **Retailer CRM** to view price tiers, credit progress bars, and ledger transactions.
  - Inspect **Reports** (Sales metrics, worker orders, price overrides, voided bills).

### 2. Test Worker Role (Billing Screen Only)
- **Logout** from the Admin account.
- **Login** using the worker credentials:
  - **Email**: `worker@pos.com`
  - **Password**: `worker123`
- **Actions to Try**:
  - The worker is immediately redirected to the **Worker Sales** page.
  - Click on a brand card (e.g., `Pepsi` or `Sprite`) to open the variants catalog.
  - Add items to the cart, override the unit prices (triggers warning flag), select a retailer, and check out.
  - Generate an invoice preview and print.

---

## 📚 Document Navigation

Read the following documentation files for a deeper understanding of the codebase structure:
1. [README.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/README.md) - Main project summary and prerequisites.
2. [ARCHITECTURE.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/ARCHITECTURE.md) - Deep-dive into models, relations, endpoints, and file layers.
3. [API_INTEGRATION.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/API_INTEGRATION.md) - Client axios services and state sync actions.
4. [Business_Rules.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/Business_Rules.md) - Validations, credit thresholds, and FIFO depletion algorithms.
5. [Database.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/Database.md) - Field-by-field database dictionary.
6. [FILES_LISTING.md](file:///c:/Users/Reshail%20Rajp00000t/Desktop/POS/MD%20Files/FILES_LISTING.md) - Tree diagram of the codebase directories.

---

## 🔧 Useful CLI Commands

### Backend Commands (run in `POS/backend/`)
- `npm run dev` - Run the API server with hot-reloading.
- `npx prisma studio` - Open a local database editor interface in your browser.
- `npm run db:seed` - Populate default users/products.
- `npx prisma db push` - Push changes in `schema.prisma` directly to PostgreSQL.

### Frontend Commands (run in `POS/`)
- `npm run dev` - Run the Vite development server.
- `npm run build` - Compile and optimize the client application for production.
- `npm run preview` - Test the production build locally.

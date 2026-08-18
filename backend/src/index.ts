/**
 * Beverage POS — Backend Entry Point
 *
 * Express application setup:
 *   - Security middleware (CORS, cookie-parser)
 *   - Request logging (morgan)
 *   - JSON body parsing
 *   - API route mounting
 *   - 404 handler
 *   - Global error handler
 *   - Graceful shutdown
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

// Config — must be imported first to validate env vars before anything else
import { env } from './config/env';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import retailerRoutes from './modules/retailers/retailer.routes';
import billRoutes from './modules/bills/bill.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import workerRoutes from './modules/workers/worker.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import rgbRoutes from './modules/rgb/rgb.routes';
import brandRoutes from './modules/brands/brand.routes';
import reminderRoutes from './modules/reminders/reminder.routes';
import pushRoutes     from './modules/push/push.routes';

// Notification scheduler
import { notifyDueReminders } from './lib/reminderNotifier';
import { webPushDeliver }     from './lib/pushNotifications';


// Prisma client (imported here to ensure singleton is initialized)
import { prisma } from './lib/prisma';

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();

// ── Security & Parsing Middleware ─────────────────────────────────────────────

app.use(
  cors({
    origin: env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : env.CORS_ORIGIN,
    credentials: true, // Required for httpOnly cookie (refresh token)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ───────────────────────────────────────────────────────────

app.use(morgan(env.isDevelopment ? 'dev' : 'combined'));

// ── Static File Serving ───────────────────────────────────────────────────────
// Serve uploaded product images at /uploads/products/{filename}
// Files are written to backend/uploads/products/ by multer
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/retailers', retailerRoutes);
app.use('/api/bills',     billRoutes);
app.use('/api/ledger',    ledgerRoutes);
app.use('/api/workers',   workerRoutes);
app.use('/api/expenses',  expenseRoutes);
app.use('/api/rgb',       rgbRoutes);
app.use('/api/brands',    brandRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/push',      pushRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌  Unhandled error:', error);

  res.status(500).json({
    success: false,
    message: env.isDevelopment
      ? error.message
      : 'An unexpected server error occurred.',
  });
});

// ── Server Start ──────────────────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  console.log('\n🚀  Beverage POS Backend');
  console.log(`    Environment : ${env.NODE_ENV}`);
  console.log(`    Server      : http://localhost:${env.PORT}`);
  console.log(`    Health      : http://localhost:${env.PORT}/health`);
  console.log('\n    API Routes:');
  console.log(`    /api/auth       — Authentication`);
  console.log(`    /api/products   — Product catalog`);
  console.log(`    /api/inventory  — Stock batches & adjustments`);
  console.log(`    /api/retailers  — Retailers, ledger & RGB`);
  console.log(`    /api/bills      — Sales bills & payments`);
  console.log(`    /api/ledger     — Ledger overview & payments`);
  console.log(`    /api/workers    — Worker management (admin)`);
  console.log(`    /api/expenses   — Expense tracking (admin)`);
  console.log(`    /api/reminders  — Payment reminders`);
  console.log(`    /api/push       — Web Push subscriptions`);
  console.log('\n    Waiting for requests...\n');
});

// ── Reminder Push Notification Scheduler ─────────────────────────────────────
// Checks for due reminders every 60s and sends web push notifications.
// webPushDeliver is the concrete transport; swap for Electron/FCM without
// touching the detection logic in reminderNotifier.ts.

const NOTIFIER_INTERVAL_MS = 60_000;

const notifierInterval = setInterval(async () => {
  try {
    await notifyDueReminders(webPushDeliver);
  } catch (err) {
    console.error('[notifier] Unexpected error in notification cycle:', err);
  }
}, NOTIFIER_INTERVAL_MS);

console.log(`[notifier] Reminder push scheduler started (every ${NOTIFIER_INTERVAL_MS / 1000}s)`);


// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n⚠️   ${signal} received. Shutting down gracefully...`);

  clearInterval(notifierInterval);

  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅  Database disconnected. Server closed.\n');
    process.exit(0);
  });

  // Force-exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('❌  Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;

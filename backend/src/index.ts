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

// Config — must be imported first to validate env vars before anything else
import { env } from './config/env';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import retailerRoutes from './modules/retailers/retailer.routes';
import billRoutes from './modules/bills/bill.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';


// Prisma client (imported here to ensure singleton is initialized)
import { prisma } from './lib/prisma';

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();

// ── Security & Parsing Middleware ─────────────────────────────────────────────

app.use(
  cors({
    origin: env.CORS_ORIGIN,
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
  console.log('\n    Waiting for requests...\n');
});


// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n⚠️   ${signal} received. Shutting down gracefully...`);

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

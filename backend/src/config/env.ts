/**
 * Environment Configuration
 *
 * Reads and validates all required environment variables at startup.
 * If any required variable is missing, the process exits immediately
 * with a clear error message (fail-fast pattern).
 *
 * Usage:
 *   import { env } from './config/env';
 *   console.log(env.PORT);
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Validator helper ──────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`\n❌  Missing required environment variable: ${key}`);
    console.error(`    Add it to backend/.env (see backend/.env.example)\n`);
    process.exit(1);
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key]?.trim() || defaultValue;
}

// ── Parsed & validated config ─────────────────────────────────────────────────

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '5000'), 10),

  DATABASE_URL: requireEnv('DATABASE_URL'),

  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  CORS_ORIGIN: optionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  get isProduction() {
    return this.NODE_ENV === 'production';
  },
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
} as const;

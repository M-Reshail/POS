/**
 * Auth Routes
 *
 * Mounts authentication endpoints on the Express router.
 * Mounted at: /api/auth (see src/index.ts)
 *
 * Public endpoints (no auth required):
 *   POST /api/auth/login    — Login (admin or worker)
 *   POST /api/auth/logout   — Logout (clear cookie)
 *   POST /api/auth/refresh  — Get new access token from refresh token
 *
 * Protected endpoints (valid access token required):
 *   GET  /api/auth/me       — Get current user profile
 */

import { Router } from 'express';
import {
  loginController,
  logoutController,
  refreshTokenController,
  getMeController,
  changePasswordController,
} from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { changePasswordRateLimiter } from './changePasswordRateLimiter';

const router = Router();

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Single login endpoint for both Admin and Worker.
 * Returns: { accessToken, user: { id, name, email, role, isActive, createdAt } }
 */
router.post('/login', loginController);

/**
 * POST /api/auth/logout
 * Clears the httpOnly refresh token cookie.
 * The client should also discard the access token from memory.
 */
router.post('/logout', logoutController);

/**
 * POST /api/auth/refresh
 * Reads refresh token from httpOnly cookie (or req.body for API testing).
 * Returns: { accessToken }
 */
router.post('/refresh', refreshTokenController);

// ── Protected Routes ──────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns the full profile of the currently authenticated user.
 * Used by the frontend on app load to restore session.
 */
router.get('/me', authenticate, getMeController);

/**
 * POST /api/auth/change-password
 * Changes password for the currently authenticated user.
 * Rate limited to 5 failed attempts per 15 minutes per user.
 */
router.post('/change-password', authenticate, changePasswordRateLimiter, changePasswordController);

export default router;

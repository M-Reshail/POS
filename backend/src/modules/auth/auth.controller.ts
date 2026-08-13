/**
 * Auth Controller
 *
 * HTTP layer for authentication endpoints.
 * Validates request input, delegates to auth.service, formats responses.
 * No business logic or direct DB access here.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { env } from '../../config/env';

// ── Input Schemas (Zod Validation) ────────────────────────────────────────────

const loginSchema = z.object({
  username: z
    .string({ required_error: 'Username is required.' })
    .min(1, 'Username cannot be empty.')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password cannot be empty.'),
});

const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required.' }),
});

// ── Error Message Map ─────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_CREDENTIALS: {
    status: 401,
    message: 'Incorrect username or password. Please try again.',
  },
  ACCOUNT_INACTIVE: {
    status: 403,
    message: 'Your account has been deactivated. Please contact an administrator.',
  },
  INVALID_REFRESH_TOKEN: {
    status: 401,
    message: 'Invalid or expired refresh token. Please log in again.',
  },
  USER_NOT_FOUND: {
    status: 404,
    message: 'User not found.',
  },
};

const handleServiceError = (res: Response, error: unknown): void => {
  if (error instanceof Error) {
    const mapped = ERROR_MESSAGES[error.message];
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
  }
  // Unknown error — rethrow for global error handler
  throw error;
};

// ── Cookie maxAge Helper ──────────────────────────────────────────────────────
// Converts a jsonwebtoken-style duration string (e.g. '10h', '7d', '30m', '60s')
// to milliseconds so the cookie's maxAge always matches the refresh JWT lifetime.
// Falls back to 10 hours if the format is unrecognised.
const parseDurationToMs = (duration: string): number => {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 10 * 60 * 60 * 1000; // fallback: 10h
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Single endpoint for both Admin and Worker login.
 * Role is embedded in the returned JWT — frontend reads it to
 * redirect to /admin/dashboard or /worker/sales.
 */
export const loginController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await authService.login(parsed.data);

    // Set refresh token as httpOnly cookie.
    // maxAge is derived from JWT_REFRESH_EXPIRES_IN so cookie lifetime
    // always matches the JWT lifetime — no more hardcoded 7-day override.
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.tokens.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

/**
 * POST /api/auth/logout
 *
 * Clears the httpOnly refresh token cookie.
 * Access token expiry is handled client-side (stateless JWT).
 */
export const logoutController = (_req: Request, res: Response): void => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

/**
 * POST /api/auth/refresh
 *
 * Issues a new access token using the refresh token from the httpOnly cookie.
 * Falls back to body if cookie is not present (for API testing).
 */
export const refreshTokenController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Prefer cookie, fallback to body (useful for Postman testing)
    const tokenFromCookie: string | undefined = req.cookies?.refreshToken;
    const tokenFromBody: string | undefined = req.body?.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'No refresh token provided.',
      });
      return;
    }

    // Validate body token if using body (cookie needs no schema validation)
    if (!tokenFromCookie && tokenFromBody) {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request body.',
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
      }
    }

    const newAccessToken = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

/**
 * GET /api/auth/me
 *
 * Returns the full user record for the currently authenticated user.
 * Requires a valid access token (authenticate middleware).
 */
export const getMeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

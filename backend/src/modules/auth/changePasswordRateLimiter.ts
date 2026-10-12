/**
 * In-memory Rate Limiter for Change Password
 *
 * Requirements:
 * - Hand-written in-memory middleware (no new dependency)
 * - Keyed by authenticated user id (req.user.id)
 * - 5 failed attempts per 15 minutes window
 * - Counts only failed attempts (wrong current password)
 * - Resets the counter on success
 * - Returns 429 with a clear message
 */

import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
}

const failedAttempts = new Map<string, AttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Middleware that checks if the user has exceeded the maximum allowed failed attempts.
 */
export const changePasswordRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
    return;
  }

  const record = failedAttempts.get(userId);
  if (record) {
    const now = Date.now();
    const elapsed = now - record.firstAttemptTime;

    if (elapsed < WINDOW_MS) {
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        const remainingMinutes = Math.ceil((WINDOW_MS - elapsed) / 60000);
        res.status(429).json({
          success: false,
          message: `Too many failed password attempts. Please try again after ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
        });
        return;
      }
    } else {
      // Window expired; clear stale record
      failedAttempts.delete(userId);
    }
  }

  next();
};

/**
 * Records a failed attempt for the user when the current password does not match.
 */
export const recordFailedChangePasswordAttempt = (userId: string): void => {
  const now = Date.now();
  const record = failedAttempts.get(userId);

  if (record && now - record.firstAttemptTime < WINDOW_MS) {
    record.count += 1;
  } else {
    failedAttempts.set(userId, { count: 1, firstAttemptTime: now });
  }
};

/**
 * Resets the failed attempt counter for a user upon successful password change.
 */
export const resetChangePasswordAttempts = (userId: string): void => {
  failedAttempts.delete(userId);
};

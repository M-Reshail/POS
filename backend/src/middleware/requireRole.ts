/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Factory function that returns an Express middleware enforcing
 * that `req.user.role` matches one of the allowed roles.
 *
 * Must be used AFTER the `authenticate` middleware.
 *
 * Usage:
 *   // Admin only
 *   router.post('/stock', authenticate, requireRole('admin'), controller);
 *
 *   // Both roles allowed
 *   router.get('/products', authenticate, requireRole('admin', 'worker'), controller);
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Should not happen if `authenticate` runs first — defensive check
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
};

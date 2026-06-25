/**
 * Express Request Augmentation
 *
 * Extends the Express Request type to include the `user` property
 * that gets attached by the JWT authentication middleware after
 * a token is successfully verified.
 *
 * Usage (in controllers/middleware):
 *   const { id, role, email } = req.user!;
 */

import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /**
       * Populated by the `authenticate` middleware after JWT verification.
       * Always present on protected routes.
       */
      user?: {
        id: string;
        role: UserRole;
        email: string;
      };
    }
  }
}

export {};

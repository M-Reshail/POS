/**
 * Auth Service
 *
 * Business logic for authentication operations.
 * All database access and token generation happens here.
 * Controllers call this service — no DB code in controllers.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { UserRole } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface LoginResult {
  tokens: AuthTokens;
  user: SafeUser;
}

// ── Token Helpers ─────────────────────────────────────────────────────────────

const generateAccessToken = (user: SafeUser): string => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    env.JWT_ACCESS_SECRET as jwt.Secret,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
  );
};

const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { sub: userId },
    env.JWT_REFRESH_SECRET as jwt.Secret,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};

// Strip passwordHash before returning user data to client
const toSafeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Authenticate user with email + password.
 * Returns JWT tokens and safe user data on success.
 * Throws on invalid credentials or inactive account.
 */
export const login = async (input: LoginInput): Promise<LoginResult> => {
  const { email, password } = input;

  // 1. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    // Use generic message to prevent email enumeration attacks
    throw new Error('INVALID_CREDENTIALS');
  }

  // 2. Check account is active
  if (!user.isActive) {
    throw new Error('ACCOUNT_INACTIVE');
  }

  // 3. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // 4. Generate tokens
  const safeUser = toSafeUser(user);
  const tokens: AuthTokens = {
    accessToken: generateAccessToken(safeUser),
    refreshToken: generateRefreshToken(user.id),
  };

  return { tokens, user: safeUser };
};

/**
 * Verify a refresh token and issue a new access token.
 * Returns new access token on success.
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<string> => {
  let payload: { sub: string };

  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || !user.isActive) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return generateAccessToken(toSafeUser(user));
};

/**
 * Fetch current user by ID from the database.
 * Used by GET /api/auth/me.
 */
export const getCurrentUser = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new Error('USER_NOT_FOUND');
  }

  return toSafeUser(user);
};

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
import { SALT_ROUNDS, COMMON_PASSWORDS } from './auth.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  name: string;
  username: string;
  email?: string | null;
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
      username: user.username,
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
  username: string | null;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  name: user.name,
  username: user.username ?? '',
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Authenticate user with username + password.
 * Returns JWT tokens and safe user data on success.
 * Throws on invalid credentials or inactive account.
 */
export const login = async (input: LoginInput): Promise<LoginResult> => {
  const { username, password } = input;

  // 1. Find user by username (case-insensitive)
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase().trim() },
  });

  if (!user) {
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

/**
 * Change authenticated user's password.
 * Verifies current password with bcrypt, validates against common passwords/username,
 * hashes with shared SALT_ROUNDS and updates database.
 *
 * NOTE: Refresh tokens are stateless JWTs and not tracked in the database.
 * No schema change is performed, so existing refresh tokens remain valid until expiry.
 * The current session remains valid and the user is not logged out on success.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new Error('USER_NOT_FOUND');
  }

  // 1. Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new Error('INVALID_CURRENT_PASSWORD');
  }

  // 2. Disallow common passwords or username as password
  const normalizedNew = newPassword.toLowerCase().trim();
  const normalizedUsername = (user.username || '').toLowerCase().trim();
  if (COMMON_PASSWORDS.includes(normalizedNew) || (normalizedUsername && normalizedNew === normalizedUsername)) {
    throw new Error('PASSWORD_TOO_COMMON');
  }

  // 3. Hash and update
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};


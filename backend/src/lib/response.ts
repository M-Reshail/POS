/**
 * Shared Response Helpers
 *
 * Standardised JSON response envelope used across all controllers.
 * Keeps response shape consistent for the frontend to consume.
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Checks if a value is a Prisma.Decimal instance or decimal-like object.
 */
const isDecimalInstance = (val: unknown): boolean => {
  if (val === null || val === undefined || typeof val !== 'object') {
    return false;
  }
  return (
    Prisma.Decimal.isDecimal(val) ||
    val instanceof Prisma.Decimal ||
    (typeof (val as any).toNumber === 'function' &&
      ('d' in val || 's' in val || 'e' in val))
  );
};

/**
 * Recursively converts Prisma.Decimal instances to JS numbers.
 * Leaves Date, string, number, boolean, null, undefined untouched.
 * Prevents string serialization of Decimal fields in JSON responses.
 */
export const serializeDecimals = (value: unknown, visited = new WeakSet()): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (isDecimalInstance(value)) {
    return Number(value);
  }

  if (typeof value === 'object') {
    if (visited.has(value as object)) {
      return value;
    }

    if (Array.isArray(value)) {
      visited.add(value);
      return value.map((item) => serializeDecimals(item, visited));
    }

    visited.add(value as object);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = serializeDecimals((value as Record<string, unknown>)[key], visited);
    }
    return result;
  }

  return value;
};

export const ok = <T>(res: Response, data: T, statusCode = 200): void => {
  res.status(statusCode).json({ success: true, data: serializeDecimals(data) });
};

export const created = <T>(res: Response, data: T): void => {
  res.status(201).json({ success: true, data: serializeDecimals(data) });
};

export const noContent = (res: Response): void => {
  res.status(204).send();
};

export const badRequest = (res: Response, message: string, errors?: unknown): void => {
  res.status(400).json({ success: false, message, ...(errors ? { errors: serializeDecimals(errors) } : {}) });
};

export const unauthorized = (res: Response, message: string): void => {
  res.status(401).json({ success: false, message });
};

export const forbidden = (res: Response, message: string): void => {
  res.status(403).json({ success: false, message });
};

export const notFound = (res: Response, message = 'Resource not found.'): void => {
  res.status(404).json({ success: false, message });
};

export const conflict = (res: Response, message: string): void => {
  res.status(409).json({ success: false, message });
};

export const unprocessable = (res: Response, message: string): void => {
  res.status(422).json({ success: false, message });
};

export const serverError = (res: Response, error: unknown): void => {
  console.error('❌ Unhandled error:', error);
  const message =
    process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An unexpected server error occurred.';
  res.status(500).json({ success: false, message });
};

// ── Service Error Mapper ──────────────────────────────────────────────────────
// Maps named service errors (thrown as new Error('SOME_CODE')) to HTTP responses.

type ErrorMap = Record<string, { status: number; message: string }>;

export const handleServiceError = (
  res: Response,
  error: unknown,
  errorMap: ErrorMap = {}
): void => {
  if (error instanceof Error) {
    const mapped = errorMap[error.message];
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
  }
  serverError(res, error);
};

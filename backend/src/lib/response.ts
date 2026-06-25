/**
 * Shared Response Helpers
 *
 * Standardised JSON response envelope used across all controllers.
 * Keeps response shape consistent for the frontend to consume.
 */

import { Response } from 'express';

export const ok = <T>(res: Response, data: T, statusCode = 200): void => {
  res.status(statusCode).json({ success: true, data });
};

export const created = <T>(res: Response, data: T): void => {
  res.status(201).json({ success: true, data });
};

export const noContent = (res: Response): void => {
  res.status(204).send();
};

export const badRequest = (res: Response, message: string, errors?: unknown): void => {
  res.status(400).json({ success: false, message, ...(errors ? { errors } : {}) });
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

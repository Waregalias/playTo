import type { ErrorCode } from '@aldenfer/shared';

/** Business rule violation carrying its API-SPEC §2 error code. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number = 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

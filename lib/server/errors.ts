/**
 * Shared error + result shapes for server actions / route handlers.
 * Server actions must return serializable values — never throw across the
 * RPC boundary (Next surfaces throws as 500s). `AppError` is caught and
 * flattened into `ActionResult.failure`.
 */

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ActionErrorCode;
  readonly status: number;
  readonly retryAfterSec?: number;

  constructor(
    code: ActionErrorCode,
    message: string,
    opts: { status?: number; retryAfterSec?: number } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? statusFor(code);
    this.retryAfterSec = opts.retryAfterSec;
  }

  toPlain() {
    return {
      code: this.code,
      message: this.message,
      retryAfterSec: this.retryAfterSec,
    };
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ReturnType<AppError["toPlain"]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(err: unknown): ActionResult<never> {
  if (err instanceof AppError) {
    return { ok: false, error: err.toPlain() };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    ok: false,
    error: new AppError("INTERNAL", message).toPlain(),
  };
}

function statusFor(code: ActionErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "VALIDATION":
      return 422;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}

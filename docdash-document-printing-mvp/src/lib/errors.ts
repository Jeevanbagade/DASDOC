/**
 * Central, typed error model shared by the client and server.
 * Every API failure carries one of these codes so the UI can react
 * deterministically and tests can assert on exact behavior.
 */
export const ERROR_CODES = [
  "VALIDATION",
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "FORBIDDEN",
  "DUPLICATE_MOBILE",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_FILE",
  "FILE_UNREADABLE",
  "DOC_NOT_FOUND",
  "DOC_ALREADY_ORDERED",
  "EMPTY_ORDER",
  "PRICING_INVALID",
  "PRICING_MISMATCH",
  "UPI_ID_INVALID",
  "PAYMENT_FAILED",
  "ORDER_NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  AUTH_EXPIRED: 401,
  FORBIDDEN: 403,
  DUPLICATE_MOBILE: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  FILE_UNREADABLE: 422,
  DOC_NOT_FOUND: 404,
  DOC_ALREADY_ORDERED: 409,
  EMPTY_ORDER: 400,
  PRICING_INVALID: 422,
  PRICING_MISMATCH: 422,
  UPI_ID_INVALID: 400,
  PAYMENT_FAILED: 402,
  ORDER_NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Error thrown by the client-side fetch helper. */
export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

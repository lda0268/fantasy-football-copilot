export const FantasyProsErrorCode = {
  NOT_CONFIGURED: "FANTASYPROS_NOT_CONFIGURED",
  UNAUTHORIZED: "FANTASYPROS_UNAUTHORIZED",
  RATE_LIMITED: "FANTASYPROS_RATE_LIMITED",
  HTTP_ERROR: "FANTASYPROS_HTTP_ERROR",
  PARSE_ERROR: "FANTASYPROS_PARSE_ERROR",
  INVALID_REQUEST: "FANTASYPROS_INVALID_REQUEST",
} as const;

export type FantasyProsErrorCode = (typeof FantasyProsErrorCode)[keyof typeof FantasyProsErrorCode];

export class FantasyProsApiError extends Error {
  readonly code: FantasyProsErrorCode;
  readonly status?: number;
  readonly path?: string;

  constructor(
    code: FantasyProsErrorCode,
    message: string,
    options?: { status?: number; path?: string },
  ) {
    super(message);
    this.name = "FantasyProsApiError";
    this.code = code;
    this.status = options?.status;
    this.path = options?.path;
  }
}

export function isFantasyProsApiError(error: unknown): error is FantasyProsApiError {
  return error instanceof FantasyProsApiError;
}

export function parseError(message: string): FantasyProsApiError {
  return new FantasyProsApiError(FantasyProsErrorCode.PARSE_ERROR, message);
}

export function invalidRequest(message: string): FantasyProsApiError {
  return new FantasyProsApiError(FantasyProsErrorCode.INVALID_REQUEST, message, { status: 400 });
}

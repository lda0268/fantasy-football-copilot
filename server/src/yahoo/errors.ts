export const YahooErrorCode = {
  NOT_CONNECTED: "YAHOO_NOT_CONNECTED",
  REFRESH_FAILED: "YAHOO_REFRESH_FAILED",
  ADDITIONAL_AUTH_REQUIRED: "YAHOO_ADDITIONAL_AUTH_REQUIRED",
  UNAUTHORIZED: "YAHOO_UNAUTHORIZED",
  HTTP_ERROR: "YAHOO_HTTP_ERROR",
  PARSE_ERROR: "YAHOO_PARSE_ERROR",
  MATCHUP_NOT_FOUND: "YAHOO_MATCHUP_NOT_FOUND",
  INVALID_REQUEST: "YAHOO_INVALID_REQUEST",
} as const;

export type YahooErrorCode = (typeof YahooErrorCode)[keyof typeof YahooErrorCode];

export class YahooApiError extends Error {
  readonly code: YahooErrorCode;
  readonly status?: number;
  readonly path?: string;

  constructor(
    code: YahooErrorCode,
    message: string,
    options?: { status?: number; path?: string },
  ) {
    super(message);
    this.name = "YahooApiError";
    this.code = code;
    this.status = options?.status;
    this.path = options?.path;
  }
}

export function isYahooApiError(error: unknown): error is YahooApiError {
  return error instanceof YahooApiError;
}

function collectText(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, into);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectText(item, into);
    }
  }
}

export function isAdditionalAuthorizationRequired(body: unknown): boolean {
  const parts: string[] = [];
  collectText(body, parts);
  return parts.some((part) => part.toLowerCase().includes("additional_authorization_required"));
}

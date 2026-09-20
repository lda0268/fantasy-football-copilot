import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function userFacingApiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (
      error.code === "additional_authorization_required" ||
      error.code === "yahoo_http_error" ||
      error.status === 403
    ) {
      return "Yahoo Fantasy data is temporarily unavailable.";
    }
    if (error.code === "not_connected") {
      return "Yahoo Fantasy is not connected.";
    }
    if (error.code === "not_configured") {
      return "FantasyPros is not configured.";
    }
    return error.message || "Request failed.";
  }
  return "Request failed.";
}

export async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) {
    const payload = isRecord(body) ? (body as ApiErrorBody) : {};
    throw new ApiError(
      response.status,
      typeof payload.error === "string" ? payload.error : "request_failed",
      typeof payload.message === "string" ? payload.message : "Request failed.",
    );
  }
  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

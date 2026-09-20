import { config } from "../config.js";
import { YahooApiError, YahooErrorCode } from "./errors.js";
import { loadYahooTokens, saveYahooTokens, type YahooTokenRecord } from "./tokenStore.js";

export const YAHOO_TOKEN_EXPIRY_SKEW_MS = 60_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseExpiresIn(value: unknown): number | null {
  const expiresIn =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }

  return expiresIn;
}

function parseRefreshTokenResponse(
  value: unknown,
  existing: YahooTokenRecord,
): YahooTokenRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (!isNonEmptyString(body.access_token)) {
    return null;
  }

  const expiresIn = parseExpiresIn(body.expires_in);
  if (expiresIn === null) {
    return null;
  }

  const now = Date.now();
  const record: YahooTokenRecord = {
    accessToken: body.access_token,
    refreshToken: isNonEmptyString(body.refresh_token) ? body.refresh_token : existing.refreshToken,
    expiresAt: now + expiresIn * 1000,
    updatedAt: now,
    tokenType: isNonEmptyString(body.token_type) ? body.token_type : existing.tokenType,
    scope: isNonEmptyString(body.scope) ? body.scope : existing.scope,
  };

  return record;
}

export async function refreshYahooAccessToken(): Promise<YahooTokenRecord> {
  const existing = await loadYahooTokens();
  if (!existing) {
    throw new YahooApiError(YahooErrorCode.NOT_CONNECTED, "Yahoo is not connected.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: existing.refreshToken,
    redirect_uri: config.yahoo.redirectUri,
  });

  const credentials = Buffer.from(
    `${config.yahoo.clientId}:${config.yahoo.clientSecret}`,
  ).toString("base64");

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(config.yahoo.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch {
    console.error("Yahoo token refresh request failed.");
    throw new YahooApiError(
      YahooErrorCode.REFRESH_FAILED,
      "Yahoo authorization must be renewed.",
    );
  }

  let tokenData: unknown;
  try {
    tokenData = await tokenResponse.json();
  } catch {
    console.error(`Yahoo token refresh returned non-JSON body (status ${tokenResponse.status}).`);
    throw new YahooApiError(
      YahooErrorCode.REFRESH_FAILED,
      "Yahoo authorization must be renewed.",
      { status: tokenResponse.status },
    );
  }

  if (!tokenResponse.ok) {
    console.error(`Yahoo token refresh failed (status ${tokenResponse.status}).`);
    throw new YahooApiError(
      YahooErrorCode.REFRESH_FAILED,
      "Yahoo authorization must be renewed.",
      { status: tokenResponse.status },
    );
  }

  const next = parseRefreshTokenResponse(tokenData, existing);
  if (!next) {
    console.error("Yahoo token refresh returned an invalid token payload.");
    throw new YahooApiError(
      YahooErrorCode.REFRESH_FAILED,
      "Yahoo authorization must be renewed.",
    );
  }

  await saveYahooTokens(next);
  return next;
}

export async function getValidYahooAccessToken(): Promise<string> {
  const existing = await loadYahooTokens();
  if (!existing) {
    throw new YahooApiError(YahooErrorCode.NOT_CONNECTED, "Yahoo is not connected.");
  }

  if (existing.expiresAt <= Date.now() + YAHOO_TOKEN_EXPIRY_SKEW_MS) {
    const refreshed = await refreshYahooAccessToken();
    return refreshed.accessToken;
  }

  return existing.accessToken;
}

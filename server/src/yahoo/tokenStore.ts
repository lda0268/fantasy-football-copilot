import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface YahooTokenRecord {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresAt: number;
  scope?: string;
  updatedAt: number;
}

function tokenStorePath(): string {
  return config.yahoo.tokenStorePath;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseStoredRecord(value: unknown, source: string): YahooTokenRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed Yahoo token store at ${source}: expected an object.`);
  }

  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.accessToken) || !isNonEmptyString(record.refreshToken)) {
    throw new Error(`Malformed Yahoo token store at ${source}: missing required token fields.`);
  }
  if (!isPositiveNumber(record.expiresAt) || !isPositiveNumber(record.updatedAt)) {
    throw new Error(`Malformed Yahoo token store at ${source}: expiresAt and updatedAt must be positive numbers.`);
  }

  const parsed: YahooTokenRecord = {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    updatedAt: record.updatedAt,
  };

  if (record.tokenType !== undefined) {
    if (!isNonEmptyString(record.tokenType)) {
      throw new Error(`Malformed Yahoo token store at ${source}: tokenType must be a non-empty string.`);
    }
    parsed.tokenType = record.tokenType;
  }

  if (record.scope !== undefined) {
    if (!isNonEmptyString(record.scope)) {
      throw new Error(`Malformed Yahoo token store at ${source}: scope must be a non-empty string.`);
    }
    parsed.scope = record.scope;
  }

  return parsed;
}

export function parseYahooTokenResponse(value: unknown): YahooTokenRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (!isNonEmptyString(body.access_token) || !isNonEmptyString(body.refresh_token)) {
    return null;
  }

  const expiresIn =
    typeof body.expires_in === "number"
      ? body.expires_in
      : typeof body.expires_in === "string" && body.expires_in.trim() !== ""
        ? Number(body.expires_in)
        : NaN;

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }

  const now = Date.now();
  const record: YahooTokenRecord = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + expiresIn * 1000,
    updatedAt: now,
  };

  if (isNonEmptyString(body.token_type)) {
    record.tokenType = body.token_type;
  }
  if (isNonEmptyString(body.scope)) {
    record.scope = body.scope;
  }

  return record;
}

export async function loadYahooTokens(): Promise<YahooTokenRecord | null> {
  const filePath = tokenStorePath();
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Malformed Yahoo token store at ${filePath}: file is not valid JSON.`);
  }

  return parseStoredRecord(parsed, filePath);
}

export async function saveYahooTokens(tokens: YahooTokenRecord): Promise<void> {
  const filePath = tokenStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });

  const payload = `${JSON.stringify(tokens, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, payload, { encoding: "utf8", mode: 0o600 });
  await rename(tempPath, filePath);
}

export async function clearYahooTokens(): Promise<void> {
  const filePath = tokenStorePath();
  try {
    await unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    throw err;
  }
}

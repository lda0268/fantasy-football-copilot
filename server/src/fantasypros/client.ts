import { config } from "../config.js";
import { FantasyProsApiError, FantasyProsErrorCode } from "./errors.js";

export type FantasyProsFetch = (input: string, init: RequestInit) => Promise<Response>;

export type FantasyProsClientOptions = {
  apiKey?: string;
  fixtureMode?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FantasyProsFetch;
};

function clientSettings(options?: FantasyProsClientOptions) {
  return {
    apiKey: options?.apiKey ?? config.fantasypros.apiKey,
    fixtureMode: options?.fixtureMode ?? config.fantasypros.fixtureMode,
    baseUrl: options?.baseUrl ?? config.fantasypros.baseUrl,
    timeoutMs: options?.timeoutMs ?? config.fantasypros.timeoutMs,
    fetchImpl: options?.fetchImpl ?? fetch,
  };
}

export function requireLiveApiKey(options?: FantasyProsClientOptions): string {
  const settings = clientSettings(options);
  if (settings.fixtureMode) {
    return "";
  }
  if (!settings.apiKey) {
    throw new FantasyProsApiError(
      FantasyProsErrorCode.NOT_CONFIGURED,
      "FantasyPros is not configured.",
      { status: 503 },
    );
  }
  return settings.apiKey;
}

function buildUrl(baseUrl: string, resourcePath: string, query: Record<string, string>): string {
  const url = new URL(resourcePath.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FantasyProsApiError(
      FantasyProsErrorCode.PARSE_ERROR,
      "FantasyPros returned a response that could not be parsed.",
      { status: response.status },
    );
  }
}

export async function fantasyProsGet(
  resourcePath: string,
  query: Record<string, string> = {},
  options?: FantasyProsClientOptions,
): Promise<unknown> {
  const settings = clientSettings(options);
  const apiKey = requireLiveApiKey(options);
  const url = buildUrl(settings.baseUrl, resourcePath, query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

  let response: Response;
  try {
    response = await settings.fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof FantasyProsApiError) {
      throw error;
    }
    throw new FantasyProsApiError(
      FantasyProsErrorCode.HTTP_ERROR,
      "FantasyPros request failed.",
      { path: resourcePath },
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await readJsonBody(response);

  if (response.status === 401 || response.status === 403) {
    throw new FantasyProsApiError(
      FantasyProsErrorCode.UNAUTHORIZED,
      "FantasyPros request was not authorized.",
      { status: response.status, path: resourcePath },
    );
  }
  if (response.status === 429) {
    throw new FantasyProsApiError(
      FantasyProsErrorCode.RATE_LIMITED,
      "FantasyPros rate limit was exceeded.",
      { status: 429, path: resourcePath },
    );
  }
  if (!response.ok) {
    console.error(`FantasyPros request failed (status ${response.status}) for ${resourcePath}.`);
    throw new FantasyProsApiError(
      FantasyProsErrorCode.HTTP_ERROR,
      "FantasyPros request failed.",
      { status: response.status, path: resourcePath },
    );
  }

  return body;
}

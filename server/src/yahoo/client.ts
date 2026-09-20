import { isAdditionalAuthorizationRequired, YahooApiError, YahooErrorCode } from "./errors.js";
import { getValidYahooAccessToken, refreshYahooAccessToken } from "./oauth.js";

const FANTASY_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

export function fantasyUrl(path: string): string {
  const trimmed = path.replace(/^\//, "");
  const queryIndex = trimmed.indexOf("?");
  const pathname = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const search = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(search);
  if (!params.has("format")) {
    params.set("format", "json");
  }
  const query = params.toString();
  return `${FANTASY_API_BASE}/${pathname}${query ? `?${query}` : ""}`;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function fetchFantasy(path: string, accessToken: string): Promise<Response> {
  return fetch(fantasyUrl(path), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

function throwForUnauthorized(body: unknown, path: string, status: number): never {
  if (isAdditionalAuthorizationRequired(body)) {
    throw new YahooApiError(
      YahooErrorCode.ADDITIONAL_AUTH_REQUIRED,
      "Yahoo OAuth is connected, but Fantasy Sports authorization is still required.",
      { status, path },
    );
  }

  throw new YahooApiError(YahooErrorCode.UNAUTHORIZED, "Yahoo request was not authorized.", {
    status,
    path,
  });
}

export async function yahooGet(path: string): Promise<unknown> {
  const firstToken = await getValidYahooAccessToken();
  let response = await fetchFantasy(path, firstToken);
  let body = await readJsonBody(response);

  if (response.status === 401) {
    if (isAdditionalAuthorizationRequired(body)) {
      throwForUnauthorized(body, path, response.status);
    }

    const refreshed = await refreshYahooAccessToken();
    response = await fetchFantasy(path, refreshed.accessToken);
    body = await readJsonBody(response);

    if (response.status === 401) {
      throwForUnauthorized(body, path, response.status);
    }
  }

  if (!response.ok) {
    if (isAdditionalAuthorizationRequired(body)) {
      throwForUnauthorized(body, path, response.status);
    }

    console.error(`Yahoo Fantasy API request failed (status ${response.status}) for ${path}.`);
    throw new YahooApiError(YahooErrorCode.HTTP_ERROR, "Yahoo Fantasy API request failed.", {
      status: response.status,
      path,
    });
  }

  return body;
}

import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { yahooGet } from "../yahoo/client.js";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import { YAHOO_TOKEN_EXPIRY_SKEW_MS } from "../yahoo/oauth.js";
import { loadYahooTokens, parseYahooTokenResponse, saveYahooTokens } from "../yahoo/tokenStore.js";

export const authRouter = Router();

authRouter.get("/yahoo", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.yahoo.clientId,
    redirect_uri: config.yahoo.redirectUri,
    response_type: "code",
  });

  const authorizationUrl = `${config.yahoo.authorizeUrl}?${params.toString()}`;
  res.redirect(authorizationUrl);
});

authRouter.get("/yahoo/status", async (_req: Request, res: Response) => {
  try {
    const tokens = await loadYahooTokens();
    if (!tokens) {
      res.json({ connected: false });
      return;
    }

    const now = Date.now();
    res.json({
      connected: true,
      expiresAt: tokens.expiresAt,
      expired: now >= tokens.expiresAt,
      expiresSoon: tokens.expiresAt <= now + YAHOO_TOKEN_EXPIRY_SKEW_MS,
      hasRefreshToken: tokens.refreshToken.length > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "token_store_unreadable", message });
  }
});

authRouter.get("/yahoo/test-api", async (_req: Request, res: Response) => {
  try {
    const data = await yahooGet("users;use_login=1/games");
    res.json({
      ok: true,
      authorized: true,
      data,
    });
  } catch (err) {
    if (isYahooApiError(err)) {
      if (err.code === YahooErrorCode.NOT_CONNECTED) {
        res.status(401).json({ ok: false, error: "not_connected" });
        return;
      }
      if (err.code === YahooErrorCode.ADDITIONAL_AUTH_REQUIRED) {
        res.status(403).json({
          ok: false,
          error: "additional_authorization_required",
          message: "Yahoo OAuth is connected, but Fantasy Sports authorization is still required.",
        });
        return;
      }
      if (err.code === YahooErrorCode.REFRESH_FAILED) {
        res.status(401).json({
          ok: false,
          error: "refresh_failed",
          message: "Yahoo authorization must be renewed.",
        });
        return;
      }
      res.status(err.status && err.status >= 400 ? err.status : 502).json({
        ok: false,
        error: "yahoo_http_error",
        message: "Yahoo Fantasy API request failed.",
      });
      return;
    }

    console.error("Yahoo diagnostic request failed.");
    res.status(500).json({
      ok: false,
      error: "yahoo_http_error",
      message: "Yahoo Fantasy API request failed.",
    });
  }
});

authRouter.get("/yahoo/callback", async (req: Request, res: Response) => {
  const code = req.query.code;
  const error = req.query.error;

  if (typeof error === "string") {
    res.status(400).json({ error, error_description: req.query.error_description });
    return;
  }

  if (typeof code !== "string" || !code) {
    res.status(400).json({ error: "missing_code", message: "Authorization code was not provided." });
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: config.yahoo.redirectUri,
      code,
    });

    const credentials = Buffer.from(
      `${config.yahoo.clientId}:${config.yahoo.clientSecret}`,
    ).toString("base64");

    const tokenResponse = await fetch(config.yahoo.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    let tokenData: unknown;
    try {
      tokenData = await tokenResponse.json();
    } catch {
      console.error(`Yahoo token exchange returned non-JSON body (status ${tokenResponse.status}).`);
      res.status(502).json({
        error: "token_exchange_failed",
        message: "Yahoo token response could not be parsed.",
      });
      return;
    }

    if (!tokenResponse.ok) {
      console.error(`Yahoo token exchange failed (status ${tokenResponse.status}).`);
      res.status(502).json({
        error: "token_exchange_failed",
        message: "Yahoo authorization could not be completed.",
      });
      return;
    }

    const tokens = parseYahooTokenResponse(tokenData);
    if (!tokens) {
      console.error("Yahoo token exchange returned an invalid token payload.");
      res.status(502).json({
        error: "invalid_token_response",
        message: "Yahoo authorization could not be completed.",
      });
      return;
    }

    await saveYahooTokens(tokens);
    res.json({
      connected: true,
      message: "Yahoo authorization completed.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Yahoo token exchange failed.");
    res.status(500).json({ error: "token_exchange_failed", message });
  }
});

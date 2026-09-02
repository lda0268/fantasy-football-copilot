import { Router, type Request, type Response } from "express";
import { config } from "../config.js";

export const authRouter = Router();

authRouter.get("/yahoo", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.yahoo.clientId,
    redirect_uri: config.yahoo.redirectUri,
    response_type: "code",
    scope: config.yahoo.scope,
  });

  const authorizationUrl = `${config.yahoo.authorizeUrl}?${params.toString()}`;
  res.redirect(authorizationUrl);
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

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;

    if (!tokenResponse.ok) {
      res.status(tokenResponse.status).json({
        error: "token_exchange_failed",
        details: tokenData,
      });
      return;
    }

    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "token_exchange_failed", message });
  }
});

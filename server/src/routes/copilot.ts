import { Router, type Request, type Response } from "express";
import { getCopilotRecommendations } from "../copilot/service.js";
import { getCopilotRecommendationsV2 } from "../copilot/v2/service.js";
import { isFantasyProsApiError, FantasyProsErrorCode } from "../fantasypros/errors.js";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";

export const copilotRouter = Router();

function sendError(res: Response, error: unknown): void {
  if (isYahooApiError(error)) {
    if (error.code === YahooErrorCode.NOT_CONNECTED) {
      res.status(401).json({ error: "not_connected" });
      return;
    }
    if (error.code === YahooErrorCode.ADDITIONAL_AUTH_REQUIRED) {
      res.status(403).json({
        error: "additional_authorization_required",
        message: "Yahoo OAuth is connected, but Fantasy Sports authorization is still required.",
      });
      return;
    }
    if (error.code === YahooErrorCode.INVALID_REQUEST) {
      res.status(400).json({
        error: "invalid_request",
        message: error.message,
      });
      return;
    }
    if (error.code === YahooErrorCode.PARSE_ERROR) {
      res.status(502).json({
        error: "yahoo_parse_error",
        message: "Yahoo Fantasy data could not be parsed.",
      });
      return;
    }
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "yahoo_http_error",
      message: "Request failed.",
    });
    return;
  }

  if (isFantasyProsApiError(error)) {
    if (error.code === FantasyProsErrorCode.NOT_CONFIGURED) {
      res.status(503).json({ error: "not_configured", message: "FantasyPros is not configured." });
      return;
    }
    if (error.code === FantasyProsErrorCode.UNAUTHORIZED) {
      res.status(401).json({ error: "unauthorized", message: "FantasyPros request was not authorized." });
      return;
    }
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "fantasypros_http_error",
      message: "FantasyPros request failed.",
    });
    return;
  }

  console.error("Co-Pilot recommendation route failed.");
  res.status(502).json({
    error: "copilot_error",
    message: "Recommendation request failed.",
  });
}

copilotRouter.get("/recommendations", async (req: Request, res: Response) => {
  try {
    res.json(await getCopilotRecommendations(req.query.limit));
  } catch (error) {
    sendError(res, error);
  }
});

copilotRouter.get("/v2/recommendations", async (req: Request, res: Response) => {
  try {
    res.json(await getCopilotRecommendationsV2(req.query.limit));
  } catch (error) {
    sendError(res, error);
  }
});

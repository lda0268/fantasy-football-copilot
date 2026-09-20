import { Router, type Request, type Response } from "express";
import { isFantasyProsApiError, FantasyProsErrorCode } from "../fantasypros/errors.js";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import { getStartSitRecommendation } from "../startSit/service.js";

export const startSitRouter = Router();

startSitRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json(await getStartSitRecommendation());
  } catch (error) {
    sendError(res, error);
  }
});

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
    if (error.code === YahooErrorCode.PARSE_ERROR) {
      res.status(502).json({
        error: "yahoo_parse_error",
        message: error.message || "Yahoo Fantasy data could not be parsed.",
      });
      return;
    }
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "yahoo_http_error",
      message: "Yahoo Fantasy API request failed.",
    });
    return;
  }
  if (isFantasyProsApiError(error)) {
    if (error.code === FantasyProsErrorCode.NOT_CONFIGURED) {
      res.status(503).json({ error: "not_configured", message: "FantasyPros is not configured." });
      return;
    }
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "fantasypros_http_error",
      message: "FantasyPros request failed.",
    });
    return;
  }
  console.error("Start/Sit route failed.");
  res.status(502).json({ error: "start_sit_error", message: "Start/Sit request failed." });
}

import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { isFantasyProsApiError, FantasyProsErrorCode } from "../fantasypros/errors.js";
import {
  composeCurrentPlayerIntelligence,
  type PlayerIntelligenceQuery,
} from "../playerIntelligence/service.js";
import type { LeagueAvailability } from "../playerIntelligence/types.js";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";

export const playerIntelligenceRouter: Router = createRouter();

const AVAILABILITY = new Set<LeagueAvailability>([
  "rostered_by_user",
  "rostered_by_other",
  "free_agent",
  "waivers",
  "unknown",
]);
const IDENTITY_STATUS = new Set(["matched", "unresolved", "ambiguous"]);

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

  console.error("Player intelligence route failed.");
  res.status(502).json({ error: "intelligence_error", message: "Player intelligence composition failed." });
}

function parseQuery(req: Request): PlayerIntelligenceQuery {
  const query: PlayerIntelligenceQuery = {};
  const position = typeof req.query.position === "string" ? req.query.position.trim().toUpperCase() : "";
  const availability = typeof req.query.availability === "string" ? req.query.availability.trim() : "";
  const identityStatus = typeof req.query.identityStatus === "string" ? req.query.identityStatus.trim() : "";
  if (position) {
    query.position = position;
  }
  if (AVAILABILITY.has(availability as LeagueAvailability)) {
    query.availability = availability as LeagueAvailability;
  }
  if (IDENTITY_STATUS.has(identityStatus)) {
    query.identityStatus = identityStatus as PlayerIntelligenceQuery["identityStatus"];
  }
  return query;
}

playerIntelligenceRouter.get("/", async (req: Request, res: Response) => {
  try {
    res.json(await composeCurrentPlayerIntelligence(parseQuery(req)));
  } catch (error) {
    sendError(res, error);
  }
});

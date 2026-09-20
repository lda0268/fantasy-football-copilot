import { Router, type Request, type Response } from "express";
import {
  getFantasyProsStatus,
  listFantasyProsPlayers,
  listInjuries,
  listRankings,
  listRosProjections,
  listWeeklyProjections,
  parseNflWeek,
  type FantasyProsRuntime,
} from "../fantasypros/service.js";
import { DEFAULT_DIAGNOSTIC_SCORING, parseScoring, providerScoring } from "../fantasypros/resources.js";
import { currentNflSeason } from "../nflSeason.js";
import { isFantasyProsApiError, FantasyProsErrorCode } from "../fantasypros/errors.js";

function sendError(res: Response, error: unknown): void {
  if (isFantasyProsApiError(error)) {
    if (error.code === FantasyProsErrorCode.NOT_CONFIGURED) {
      res.status(503).json({ error: "not_configured", message: "FantasyPros is not configured." });
      return;
    }
    if (error.code === FantasyProsErrorCode.UNAUTHORIZED) {
      res.status(401).json({ error: "unauthorized", message: "FantasyPros request was not authorized." });
      return;
    }
    if (error.code === FantasyProsErrorCode.RATE_LIMITED) {
      res.status(429).json({ error: "rate_limited", message: "FantasyPros rate limit was exceeded." });
      return;
    }
    if (error.code === FantasyProsErrorCode.PARSE_ERROR) {
      res.status(502).json({ error: "fantasypros_parse_error", message: "FantasyPros data could not be parsed." });
      return;
    }
    if (error.code === FantasyProsErrorCode.INVALID_REQUEST) {
      res.status(400).json({ error: "invalid_request", message: error.message });
      return;
    }
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "fantasypros_http_error",
      message: "FantasyPros request failed.",
    });
    return;
  }

  console.error("FantasyPros route failed.");
  res.status(502).json({ error: "fantasypros_http_error", message: "FantasyPros request failed." });
}

function scoringMeta(req: Request) {
  const scoring = parseScoring(req.query.scoring);
  return {
    scoring,
    providerScoring: providerScoring(scoring),
    defaultScoring: DEFAULT_DIAGNOSTIC_SCORING,
    season: currentNflSeason(),
  };
}

export function createFantasyProsRouter(runtime?: FantasyProsRuntime): Router {
  const fantasyProsRouter = Router();

  fantasyProsRouter.get("/status", (_req: Request, res: Response) => {
    try {
      res.json(getFantasyProsStatus(runtime));
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/players", async (_req: Request, res: Response) => {
    try {
      res.json({ season: currentNflSeason(), players: await listFantasyProsPlayers(runtime) });
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/projections/weekly", async (req: Request, res: Response) => {
    try {
      const week = parseNflWeek(req.query.week, true) as number;
      const meta = scoringMeta(req);
      res.json({
        ...meta,
        week,
        projectionType: "weekly",
        players: await listWeeklyProjections(week, meta.scoring, runtime),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/projections/ros", async (req: Request, res: Response) => {
    try {
      const meta = scoringMeta(req);
      res.json({
        ...meta,
        projectionType: "ros",
        players: await listRosProjections(meta.scoring, runtime),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/rankings/weekly", async (req: Request, res: Response) => {
    try {
      const week = parseNflWeek(req.query.week, true) as number;
      const meta = scoringMeta(req);
      res.json({
        ...meta,
        week,
        rankingType: "weekly",
        players: await listRankings("weekly", { week, scoring: meta.scoring }, runtime),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/rankings/ros", async (req: Request, res: Response) => {
    try {
      const meta = scoringMeta(req);
      res.json({
        ...meta,
        rankingType: "ros",
        players: await listRankings("ros", { scoring: meta.scoring }, runtime),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  fantasyProsRouter.get("/injuries", async (req: Request, res: Response) => {
    try {
      const week = parseNflWeek(req.query.week, false);
      res.json({
        season: currentNflSeason(),
        week: week ?? null,
        injuries: await listInjuries(week, runtime),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  return fantasyProsRouter;
}

export const fantasyProsRouter = createFantasyProsRouter();

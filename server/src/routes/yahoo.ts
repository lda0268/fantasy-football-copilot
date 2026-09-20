import { Router, type Request, type Response } from "express";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import {
  getYahooFreeAgents,
  getYahooLeagueSettings,
  getYahooMatchup,
  getYahooPlayerSearch,
  getYahooRoster,
  getYahooStandings,
  getYahooStatus,
  getYahooTeam,
  getYahooTeamRoster,
  listYahooGames,
  listYahooLeagues,
  listYahooMatchups,
} from "../yahoo/season.js";
import { parsePlayerListQuery, parsePlayerSearchQuery } from "../yahoo/playerQuery.js";

export const yahooRouter = Router();

function sendYahooError(res: Response, error: unknown): void {
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
    if (error.code === YahooErrorCode.REFRESH_FAILED) {
      res.status(401).json({
        error: "refresh_failed",
        message: "Yahoo authorization must be renewed.",
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
    if (error.code === YahooErrorCode.MATCHUP_NOT_FOUND) {
      res.status(404).json({
        error: "yahoo_matchup_not_found",
        message: "No matchup was found for the authenticated user's team.",
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
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: "yahoo_http_error",
      message: "Yahoo Fantasy API request failed.",
    });
    return;
  }

  console.error("Yahoo API route failed.");
  res.status(502).json({
    error: "yahoo_http_error",
    message: "Yahoo Fantasy API request failed.",
  });
}

yahooRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    res.json(await getYahooStatus());
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/games", async (_req: Request, res: Response) => {
  try {
    res.json({ games: await listYahooGames() });
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/leagues", async (_req: Request, res: Response) => {
  try {
    res.json({ leagues: await listYahooLeagues() });
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/team", async (_req: Request, res: Response) => {
  try {
    res.json({ team: await getYahooTeam() });
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/roster", async (req: Request, res: Response) => {
  try {
    const teamKey = typeof req.query.teamKey === "string" ? req.query.teamKey : undefined;
    res.json(teamKey ? await getYahooTeamRoster(teamKey) : await getYahooRoster());
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/matchup", async (_req: Request, res: Response) => {
  try {
    res.json({ matchup: await getYahooMatchup() });
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/scoreboard", async (_req: Request, res: Response) => {
  try {
    res.json(await listYahooMatchups());
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/league-settings", async (_req: Request, res: Response) => {
  try {
    res.json(await getYahooLeagueSettings());
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/standings", async (_req: Request, res: Response) => {
  try {
    res.json(await getYahooStandings());
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/free-agents", async (req: Request, res: Response) => {
  try {
    res.json(await getYahooFreeAgents(parsePlayerListQuery(req.query)));
  } catch (error) {
    sendYahooError(res, error);
  }
});

yahooRouter.get("/players/search", async (req: Request, res: Response) => {
  try {
    const result = await getYahooPlayerSearch(parsePlayerSearchQuery(req.query));
    res.json(result);
  } catch (error) {
    sendYahooError(res, error);
  }
});

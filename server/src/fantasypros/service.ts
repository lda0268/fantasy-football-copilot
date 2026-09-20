import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { currentNflSeason, NFL_REGULAR_WEEK_MAX, NFL_REGULAR_WEEK_MIN } from "../nflSeason.js";
import { cacheKey, FP_CACHE_TTL_MS, TtlCache } from "./cache.js";
import { fantasyProsGet, type FantasyProsClientOptions } from "./client.js";
import { invalidRequest } from "./errors.js";
import { parseFantasyProsInjuries } from "./parsers/injuries.js";
import { parseFantasyProsPlayers } from "./parsers/players.js";
import { parseRosProjections, parseWeeklyProjections } from "./parsers/projections.js";
import { parseFantasyProsRankings } from "./parsers/rankings.js";
import {
  consensusRankingsResource,
  DEFAULT_DIAGNOSTIC_SCORING,
  injuriesQuery,
  injuriesResource,
  playersQuery,
  playersResource,
  projectionsResource,
  rankingsQuery,
  rosProjectionsQuery,
  weeklyProjectionsQuery,
} from "./resources.js";
import type {
  FantasyProsInjury,
  FantasyProsPlayer,
  FantasyProsRanking,
  FantasyProsRankingType,
  FantasyProsRosProjection,
  FantasyProsScoring,
  FantasyProsStatus,
  FantasyProsWeeklyProjection,
} from "./types.js";

export type FantasyProsRuntime = FantasyProsClientOptions & {
  cache?: TtlCache;
  fixturesDir?: string;
  season?: number;
};

const defaultCache = new TtlCache();

function runtimeSettings(runtime?: FantasyProsRuntime) {
  return {
    fixtureMode: runtime?.fixtureMode ?? config.fantasypros.fixtureMode,
    fixturesDir: runtime?.fixturesDir ?? config.fantasypros.fixturesDir,
    cache: runtime?.cache ?? defaultCache,
    season: runtime?.season ?? currentNflSeason(),
    client: runtime,
  };
}

async function readFixture(fileName: string, fixturesDir: string): Promise<unknown> {
  const raw = await readFile(path.join(fixturesDir, fileName), "utf8");
  return JSON.parse(raw) as unknown;
}

async function cached<T>(
  runtime: ReturnType<typeof runtimeSettings>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = runtime.cache.get<T>(key);
  if (hit !== undefined) {
    return hit;
  }
  const value = await load();
  runtime.cache.set(key, value, ttlMs);
  return value;
}

export function getFantasyProsStatus(runtime?: FantasyProsRuntime): FantasyProsStatus {
  const settings = runtimeSettings(runtime);
  const configured = settings.fixtureMode || Boolean(runtime?.apiKey ?? config.fantasypros.apiKey);
  return {
    configured,
    mode: settings.fixtureMode ? "fixture" : "live",
  };
}

export function parseNflWeek(value: unknown, required = true): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") {
    if (required) {
      throw invalidRequest(`week must be an integer between ${NFL_REGULAR_WEEK_MIN} and ${NFL_REGULAR_WEEK_MAX}.`);
    }
    return undefined;
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw invalidRequest(`week must be an integer between ${NFL_REGULAR_WEEK_MIN} and ${NFL_REGULAR_WEEK_MAX}.`);
  }
  const week = Number(text);
  if (week < NFL_REGULAR_WEEK_MIN || week > NFL_REGULAR_WEEK_MAX) {
    throw invalidRequest(`week must be an integer between ${NFL_REGULAR_WEEK_MIN} and ${NFL_REGULAR_WEEK_MAX}.`);
  }
  return week;
}

export async function listFantasyProsPlayers(runtime?: FantasyProsRuntime): Promise<FantasyProsPlayer[]> {
  const settings = runtimeSettings(runtime);
  const key = cacheKey(["players", settings.season, settings.fixtureMode]);
  return cached(settings, key, FP_CACHE_TTL_MS.players, async () => {
    const payload = settings.fixtureMode
      ? await readFixture("players.json", settings.fixturesDir)
      : await fantasyProsGet(playersResource(), playersQuery(), settings.client);
    return parseFantasyProsPlayers(payload);
  });
}

export async function listWeeklyProjections(
  week: number,
  scoring: FantasyProsScoring = DEFAULT_DIAGNOSTIC_SCORING,
  runtime?: FantasyProsRuntime,
): Promise<FantasyProsWeeklyProjection[]> {
  const settings = runtimeSettings(runtime);
  const key = cacheKey(["weekly-projections", settings.season, week, scoring, settings.fixtureMode]);
  return cached(settings, key, FP_CACHE_TTL_MS.weeklyProjections, async () => {
    const payload = settings.fixtureMode
      ? await readFixture("projections-weekly.json", settings.fixturesDir)
      : await fantasyProsGet(
          projectionsResource(settings.season),
          weeklyProjectionsQuery(week, scoring),
          settings.client,
        );
    return parseWeeklyProjections(payload, week, scoring);
  });
}

export async function listRosProjections(
  scoring: FantasyProsScoring = DEFAULT_DIAGNOSTIC_SCORING,
  runtime?: FantasyProsRuntime,
): Promise<FantasyProsRosProjection[]> {
  const settings = runtimeSettings(runtime);
  const key = cacheKey(["ros-projections", settings.season, scoring, settings.fixtureMode]);
  return cached(settings, key, FP_CACHE_TTL_MS.rosProjections, async () => {
    const payload = settings.fixtureMode
      ? await readFixture("projections-ros.json", settings.fixturesDir)
      : await fantasyProsGet(
          projectionsResource(settings.season),
          rosProjectionsQuery(scoring),
          settings.client,
        );
    return parseRosProjections(payload, scoring);
  });
}

export async function listRankings(
  rankingType: FantasyProsRankingType,
  options: { week?: number; scoring?: FantasyProsScoring } = {},
  runtime?: FantasyProsRuntime,
): Promise<FantasyProsRanking[]> {
  const scoring = options.scoring ?? DEFAULT_DIAGNOSTIC_SCORING;
  const settings = runtimeSettings(runtime);
  const key = cacheKey(["rankings", rankingType, settings.season, options.week, scoring, settings.fixtureMode]);
  return cached(settings, key, FP_CACHE_TTL_MS.ecr, async () => {
    const payload = settings.fixtureMode
      ? await readFixture(
          rankingType === "ros" ? "rankings-ros.json" : "rankings-weekly.json",
          settings.fixturesDir,
        )
      : await fantasyProsGet(
          consensusRankingsResource(settings.season),
          rankingsQuery(scoring, rankingType, options.week),
          settings.client,
        );
    return parseFantasyProsRankings(payload, rankingType);
  });
}

export async function listInjuries(week?: number, runtime?: FantasyProsRuntime): Promise<FantasyProsInjury[]> {
  const settings = runtimeSettings(runtime);
  const key = cacheKey(["injuries", settings.season, week, settings.fixtureMode]);
  return cached(settings, key, FP_CACHE_TTL_MS.injuries, async () => {
    const payload = settings.fixtureMode
      ? await readFixture("injuries.json", settings.fixturesDir)
      : await fantasyProsGet(injuriesResource(), injuriesQuery(settings.season, week), settings.client);
    return parseFantasyProsInjuries(payload);
  });
}

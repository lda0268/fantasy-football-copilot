# FantasyPros adapter

Read-only provider adapter for FantasyPros NFL intelligence. It is **not** wired into Co-Pilot scoring, Yahoo matching, or the Draft Room.

## Purpose

Expose normalized:

- players
- weekly projections
- rest-of-season projections
- consensus rankings / ECR (weekly vs ROS)
- injuries / practice report fields that FantasyPros actually returns

## Authentication

Official public API (OpenAPI `fantasypros_v2_public.yml`):

- Base URL: `https://api.fantasypros.com/public/v2/json`
- Header: `x-api-key`
- The key is never placed in query strings, logs, errors, `/status`, or JSON responses.

Live requests require `FANTASYPROS_API_KEY`. Fixture mode (`FANTASYPROS_FIXTURE_MODE=true`) does not.

## Endpoints used

All paths are built in `server/src/fantasypros/resources.ts`.

| Concept | Method / path | Notes |
|---|---|---|
| Players | `GET /nfl/players` | `external_ids=yahoo:espn:nfl` |
| Weekly projections | `GET /nfl/{season}/projections` | `week`, `scoring`, `positions=QB:RB:WR:TE:K:DST` |
| ROS projections | `GET /nfl/{season}/projections` | `ros=true`, `scoring`, `positions=...` |
| Weekly ECR | `GET /nfl/{season}/consensus-rankings` | `position=ALL`, `scoring`, `week` |
| ROS ECR | `GET /nfl/{season}/consensus-rankings` | `position=ALL`, `scoring`, `type=ROS` |
| Injuries | `GET /nfl/injuries` | `year={season}`, optional `week` |

Season comes from `currentNflSeason()` (March–December uses the UTC calendar year; January–February uses the previous year). It is not hardcoded to 2026.

## Scoring format

Adapter enum: `standard` | `half_ppr` | `ppr`

Mapped to FantasyPros: `STD` | `HALF` | `PPR`

Diagnostic routes default to **`half_ppr` (`HALF`)** and return that choice in response metadata (`scoring`, `providerScoring`, `defaultScoring`). Yahoo league scoring is not applied here.

When FantasyPros returns `points`, `points_half`, and `points_ppr`, all three are preserved on `fantasyPointsByScoring`. `fantasyPoints` is the value for the requested scoring system.

## Cache TTLs

In-memory only. Errors are not cached.

| Dataset | TTL |
|---|---|
| Players | 24 hours |
| Weekly projections | 30 minutes |
| ROS projections | 6 hours |
| ECR | 30 minutes |
| Injuries | 15 minutes |

Cache keys include season, week, scoring, ranking type, and fixture/live mode.

## Fixture mode

Yahoo-shaped **names** are reused so later identity matching can be tested. Provider JSON is still FantasyPros-shaped (`player_id`, `fpid`, `stats.points_half`, `rank_ecr`, etc.). No real NFL players.

## Errors

| Code | Typical HTTP |
|---|---|
| `FANTASYPROS_NOT_CONFIGURED` | 503 |
| `FANTASYPROS_UNAUTHORIZED` | 401 |
| `FANTASYPROS_RATE_LIMITED` | 429 |
| `FANTASYPROS_PARSE_ERROR` | 502 |
| `FANTASYPROS_HTTP_ERROR` | provider status / 502 |
| `FANTASYPROS_INVALID_REQUEST` | 400 |

## Security

- Do not log `x-api-key` or the key value
- `/api/fantasypros/status` returns only `{ configured, mode }`
- `.env` is gitignored

## Assumptions to validate live

- Public v2 base URL vs older `https://api.fantasypros.com/v2/json` (both appear in FantasyPros materials; this adapter uses the OpenAPI public base)
- Weekly ECR is `consensus-rankings` with `week` and **without** `type=ROS`
- ROS projections use boolean query `ros=true`
- `stats` may be an object (classic examples) or an array (OpenAPI); both are parsed
- `external_ids=yahoo:espn:nfl` is accepted (described as colon-delimited; schema enum lists single sources)
- NFL `DST` is the defense position key (not Yahoo `DEF`)
- Free/HOF plan coverage for these endpoints

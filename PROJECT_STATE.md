# Fantasy Football Co-Pilot — Project State

Last validated: 2026-09-01

Live-draft copilot for a 10-team Yahoo Superflex PPR redraft league. The Draft Room uses real 2026 ESPN rankings, Superflex consensus ADP, and consensus preseason projections. Manual pick tracking is the only live-draft input. Yahoo OAuth exists on the server but live Yahoo draft sync is not implemented. Draft Intelligence v2 and Monte Carlo Draft Simulator v1 are live on top of the existing engines.

**129 tests passed** after Superflex QB Calibration v1.

---

## Current status

| Area | State |
|---|---|
| Draft Room UI | Live; Available Players uses the 300-player ESPN universe |
| ESPN 2026 PPR Top 300 | Loaded (300 players); expert source preserved |
| 10-team Superflex Consensus ADP | Loaded (300 records); market source preserved |
| Projection Engine v1 | Live; consensus sets selected, Yahoo scoring applied |
| Manual draft tracking | Implemented (click-to-draft, undo, history, localStorage `ffc-draft-state-v4`) |
| Yahoo OAuth | Server authorize + token callback only |
| Yahoo live draft sync | Not implemented (`YahooPickSource` throws) |
| Screenshot pick source | Not implemented |
| Draft Intelligence v2 | Live: opponent rosters, in-draft learning, greedy sequence take/wait |
| Monte Carlo Draft Simulator v1 | Live additive layer: seeded weighted opponent sampling, 2-pick EV, async UI |
| Superflex QB Calibration v1 | Live: marginal Superflex replacement, starter-slot / lineup marginal value, round pressure, diminishing depth, late K/DEF completion |

---

## League settings (source of truth)

Configured as `DEFAULT_LEAGUE` in `client/src/types/league.ts`. This is the user’s actual Yahoo league, not ESPN standard 1QB.

**Roster (10 teams)**

- 1 QB
- 2 RB
- 3 WR
- 1 TE
- 1 FLEX (WR/RB/TE)
- 1 SUPERFLEX (QB/WR/RB/TE)
- 1 K
- 1 DEF
- 7 bench
- 2 IR

FLEX and SUPERFLEX are roster slots, not player positions. Player positions are only: QB, RB, WR, TE, K, DEF.

**Scoring (fractional)**

| Stat | Points |
|---|---|
| Passing yards | 1 per 25 |
| Passing TD | 6 |
| Interception | −2 |
| Rushing yards | 1 per 10 |
| Rushing TD | 6 |
| Reception | 1 (full PPR) |
| Receiving yards | 1 per 10 |
| Receiving TD | 6 |
| Return yards | 1 per 20 |
| Return TD | 6 |
| 2-point conversion | 4 |
| Fumble lost | −2 |

Kickers: FG 0–39 = 3, 40–49 = 4, 50+ = 5, PAT = 1.

Defense: sack = 2, INT = 3, FR = 3, TD = 6, safety = 4, blocked kick = 4, plus points-allowed buckets.

Implications:

- Do **not** treat ESPN overall rank as league-adjusted value (ESPN is typically 1QB, 4-pt passing TD).
- Do **not** treat Superflex ADP as optimal strategy.
- SUPERFLEX must deepen QB replacement versus 1QB.
- Three WR starters must deepen WR replacement versus 2-WR leagues.

---

## Architecture

```
client/   Vite + React + TypeScript  (Draft Room + engines)
server/   Express                    (Yahoo OAuth only)
```

**Data flow**

1. Load ESPN Top 300 → base player universe.
2. Match Superflex ADP onto that universe (name + position; team to disambiguate). Keep expert and market fields separate.
3. Parse the multi-set projection CSV. Select consensus sets. Do **not** treat every CSV row as a player.
4. Match selected projections onto the universe. Compute Yahoo league-adjusted points from raw stats.
5. Recommendation engine: VOR / replacement / tiers / scarcity from projected points, plus expert, ADP, roster need, survival/opportunity cost.
6. Draft Intelligence v2: opponent rosters from picks, in-draft ADP-reach learning, greedy window simulation for take vs wait.
7. Monte Carlo v1: probabilistic opponent sampling and 2-pick expected value; does not replace deterministic recommendation scores.
8. Draft Room reads `DRAFT_PLAYERS`, scores available players, supports manual picks. Monte Carlo runs asynchronously after scoring.

**Pick sources** (`PickSource`)

| Implementation | Status |
|---|---|
| `ManualPickSource` | Active |
| `YahooPickSource` | Stub only |
| `ScreenshotPickSource` | Stub only |

---

## Important files

### Data

| Path | Role |
|---|---|
| `client/src/data/imported/espn_2026_ppr_top300.json` | ESPN expert rankings |
| `client/src/data/imported/superflex_consensus_adp_10team_ppr.json` | Superflex market ADP |
| `client/src/data/imported/projection-set-preseason-all-2026.csv` | Multi-analyst 2026 preseason projections |
| `client/src/data/loadEspnRankings.ts` | ESPN loader (`ExpertRankingSource`) |
| `client/src/data/loadSuperflexAdp.ts` | ADP loader (`MarketADPSource`) |
| `client/src/data/loadProjections.ts` | Projection CSV glob loader + import report |
| `client/src/data/draftUniverse.ts` | Merge ESPN + ADP + projections → `DRAFT_PLAYERS` |
| `client/src/data/mockPlayers.ts` | Synthetic fixtures for older engine tests only |

Do not use a merged-preview file as a production source.

### Engines

| Path | Role |
|---|---|
| `client/src/engine/projections/` | Parse CSV, select consensus sets, score, merge |
| `client/src/engine/scoring.ts` | League points from stats or attached `PlayerProjection` |
| `client/src/engine/starterDemand.ts` | Dynamic starter demand / replacement rank |
| `client/src/engine/replacement.ts` | Replacement projected points |
| `client/src/engine/vor.ts` | VOR = projected points − replacement |
| `client/src/engine/tiers.ts` | Gap-based positional tiers |
| `client/src/engine/scarcity.ts` | Remaining quality + tier drop |
| `client/src/engine/recommendations.ts` | Weighted recommendation score |
| `client/src/engine/opponentRosters.ts` | League-wide rosters from tracked picks |
| `client/src/engine/draftLearning.ts` | In-draft ADP reach / position-run learning |
| `client/src/engine/draftSequence.ts` | Greedy opponent window simulation |
| `client/src/engine/monteCarlo/` | Seeded Monte Carlo survival, 2-pick EV, pair optimization |
| `client/src/engine/data/normalizeName.ts` | Identity normalization + aliases |
| `client/src/engine/data/playerMatch.ts` | Match / unmatched / ambiguous (no blind fuzzy match) |
| `client/src/engine/manualDraft.ts` | Apply / undo picks |
| `client/src/hooks/useDraftRoom.ts` | Draft Room state |

### UI

`DraftRoom`, `AvailablePlayers`, `QuickDraftList`, `Recommendations`, `TakeVsWait`, `MyRoster`, `DraftHistory`, `DraftStatus`.

### Server

`server/src/routes/auth.ts` — `GET /auth/yahoo`, `GET /auth/yahoo/callback`. No fantasy API / draft board calls.

---

## Data sources (kept separate)

| Layer | Source label | Role |
|---|---|---|
| Expert | ESPN 2026 PPR Top 300 | `expert.overallRank`, positional rank, auction, bye |
| Market | 10-Team Superflex Consensus ADP | `market.adp`, positional ADP |
| Projection | Consensus set IDs below | Raw volume stats + league-adjusted points |
| Analytics | Internal engine | VOR, tiers, scarcity, recommendation score |

Example (Josh Allen): expert overall rank **36**, Superflex ADP **3**, projection set **68137**, Yahoo points **406.1**. None of these overwrites the others.

### ESPN + ADP merge (prior validation)

- 300 ESPN + 300 ADP
- 260 matched, 40 ESPN-only (kept, ADP null), 40 ADP-only (logged, not added to the pool)
- Base universe remains ESPN Top 300

---

## Projection Engine v1 (validated)

File: `projection-set-preseason-all-2026.csv`

The file contains **multiple projection sets**. Rows are not players.

### Validated load

| Metric | Value |
|---|---|
| CSV rows loaded | **6,587** |
| Projection sets discovered | **21** |
| IDP rows excluded | **3,381** |
| Skill projections used | **550** (80 QB / 133 RB / 209 WR / 128 TE) |
| K used | **44** |
| DEF used | **32** |
| Matched to ESPN/ADP Top 300 | **300 / 300** |
| Projection-only (outside Top 300) | **326** (logged, not added) |
| ESPN/ADP with no projection | **0** |
| Ambiguous matches | **0** |
| Duplicate identities in selected sets | **0** |

### All `Projections Consensus` set IDs

`67148`, `68086`, `68137`, `68160`, `68166`

Sets are **not** averaged.

### Selected sets

| Role | Set ID | Why |
|---|---|---|
| Skill (QB/RB/WR/TE) | **68137** | Most complete consensus redraft skill coverage (550 unique) |
| K | **68086** | Only consensus kicker set (44 `pk`) |
| DEF | **67148** | 32 team defenses; tied with `68160` (same 32 names); first-seen tie-break |

`68166` is almost entirely IDP plus one WR — not used as the skill universe. `Bottom Line Consensus` is a different product and is not selected.

Position map: `qb→QB`, `rb→RB`, `wr→WR`, `te→TE`, `pk→K`, `td→DEF`. IDP (`lb`, `cb`, `de`, `dt`, `s`, …) is excluded from the active pool but not deleted as a concept.

### Yahoo points from raw stats

2-point conversions: `pass-2pt` + `rush-2pt` + `rec-2pt` counted as independent plays, each at 4 points. Not double-counted as TDs.

Returns: combine PR+KR yards and TDs.

**Kickers (partial):** PAT from `kck-xpm` only. FGM/FGA are stored. Distance buckets are **not invented**. Consensus set **68086 has FGM but `kck-xpm` = 0**, so current kicker partial points are 0. Marked incomplete.

**Defense (partial):** sack, INT, FR, TD, safety, blocked kick. Season-total `tmd-pa` is **not** converted into weekly points-allowed bonuses. Marked incomplete.

### Sample league-adjusted points (set 68137)

| Player | Pos | Yahoo pts | Replacement | VOR | Rec score |
|---|---|---|---|---|---|
| Josh Allen | QB | 406.1 | 297.1 | +109.0 | ~73 |
| Jahmyr Gibbs | RB | 341.8 | 171.8 | +169.9 | ~79 |
| Puka Nacua | WR | 314.8 | 177.5 | +137.3 | 83 |
| Trey McBride | TE | 234.0 | 144.4 | +89.6 | 75 |

Josh Allen raw (68137): 3757.42 pass yds, 27.11 pass TD, 10.8 INT, 548.51 rush yds, 11.13 rush TD, 3.44 fumbles, 0 two-point, 0 returns → **406.1078**.

### Replacement (dynamic)

Rank = round(starter demand) + 1. Demand = dedicated starters + FLEX share + SUPERFLEX share + modest Superflex QB startable-depth.

SUPERFLEX fill is **QB vs best leftover skill**, not a four-way split of top-10 quality. The old model compared CMC vs Allen for Superflex share and produced QB15 (~329 pts), so Allen VOR (~+77) lost to Gibbs (~+172). Marginal leftover QBs (after dedicated QB1s) vs leftover RB/WR/TE is the justified Superflex demand.

| Pos | Dedicated | Rank | Points |
|---|---|---|---|
| QB | 10 | **20** | 297.1 |
| RB | 20 | 26 | 171.8 |
| WR | 30 | 36 | 179.6 |
| TE | 10 | 15 | 144.4 |
| K | 10 | 11 | 0 (PAT-only; xpm missing) |
| DEF | 10 | 11 | 92.0 (no PA buckets) |

### Identity matching

Primary: normalized name + normalized position. Secondary: team. Source IDs are not a crosswalk (ESPN vs projection IDs differ).

Normalization: case, punctuation, apostrophes, periods, hyphens, Jr/Sr/II/III/IV, D/ST↔DEF, team abbreviations, first-name aliases (Cam/Cameron, Ken/Kenny/Kenneth, Chig/Chigoziem), Unicode combining marks (Eddy Piñeiro ↔ Eddy Pineiro).

No blind fuzzy last-name matching (Tank Dell ≠ Nathaniel Dell).

**Ken/Kenneth alias:** ESPN **Kenneth Walker III** matches projections **Ken Walker III**. Kenny Gainwell still matches Kenneth Gainwell; last names keep those identities separate.

---

## Recommendation weights

`client/src/engine/constants.ts` (configurable constants, not hardcoded strategy):

| Input | Weight |
|---|---|
| League-adjusted VOR | 30% |
| Scarcity / tier | 20% |
| Survival / opportunity cost | 15% |
| Expert ranking value | 15% |
| Market ADP value | 10% |
| Roster need | 10% |

Projected points power VOR, replacement, tiers, and scarcity. They are **not** an extra independent weight (that would double-count VOR).

Missing ADP or ESPN rank still produces a finite score. Missing projections on a player leaves them in Available Players.

Default Available Players sort: recommendation score, then Superflex ADP, then ESPN rank.

---

## Draft Room behavior

- Available columns: Player, Pos, Team, Projected Points, ESPN Rank, Superflex ADP, League Rank, Recommendation Score, Survival %
- Partial K/DEF points show `*`
- Position filters, quick search, single-click draft, undo, draft history
- Quick Draft: top available (name, pos, team, ADP)
- Recommendations can cite projected points, VOR vs replacement, elite QB tier, Superflex scarcity, survival, predicted taker, position runs
- Take vs Wait blends ADP survival with a greedy opponent-window simulation and roster-based league demand
- Monte Carlo panel (async) shows player/tier survival, take vs wait 2-pick EV, and best expected sequence

---

## Yahoo OAuth vs live sync

OAuth is **not** live draft integration.

- Implemented: redirect to Yahoo, exchange code for tokens (`server/src/routes/auth.ts`)
- Not implemented: fantasy league API, draft board polling, applying Yahoo picks to Draft Room

Do not delete OAuth code. Do not implement Yahoo live sync until explicitly requested.

---

## Known gaps

1. **Kicker scoring incomplete** — no FG distance buckets; consensus `kck-xpm` is 0.
2. **Defense PA incomplete** — no weekly points-allowed distribution.
3. **326 projection-only players** outside ESPN Top 300 — logged, not in Available Players (by design; ESPN is the universe).
4. **40 ADP-only names** from the ADP merge — not in the ESPN pool.
5. DEF consensus `67148` vs `68160` — same 32 teams; tie-break is first-seen, not a quality difference.
6. `ssn-ssn` in the CSV is `0`, not `2026` — unused except as a weak tie-break.
7. No weekly projections, injury news feed, or opponent-adjusted rest-of-season model.
8. Yahoo live picks and screenshot OCR are stubs.
9. Draft Intelligence v2 opponent picks are a greedy ADP + roster-need model, not a full multi-path draft tree.
10. Monte Carlo v1 uses a plausible ADP/VOR window and a 2-pick horizon, not a full-draft search.
11. Elite Superflex QBs are competitive but still trail elite RB VOR at pick 1 (not a 1QB model, also not ADP-forced QB1).

---

## Tests

**129 passed** (Vitest in `client/`).

Coverage includes Yahoo scoring math, consensus-set selection, IDP exclusion, identity matching (including Ken/Kenneth Walker), missing-source fallbacks, Superflex QB VOR, 3-WR replacement, live CSV load (6,587 rows), Josh Allen scoring from raw consensus stats, opponent roster demand, in-draft learning, window-simulation take/wait, seeded Monte Carlo RNG/snake/survival/EV/pair tests, Superflex QB calibration (0-QB vs 2-QB need, pressure after QB2, WR8 vs WR3, TE5 vs TE1, late K/DEF completion, Superflex off, 1QB does not inherit SF QB2 pressure).

`mockPlayers.ts` remains for historical engine tests. Production Draft Room does not use it.

---

## Superflex QB Calibration v1

Inputs improved; recommendation weights unchanged (30/20/15/15/10/10).

- Starter-slot utility, `marginalStartingLineupValue`, round-based starter pressure, diminishing depth, late exclusive-slot crowding for K/DEF
- Five 18-round mocks (slots 1/3/5/8/10) following #1 rec: **2–3 QBs** each; K/DEF filled R15–16; no empty starters
- First-round board still led by elite RB/WR; Josh Allen appears in the top 8 at most slots (~73) and is not forced #1
- Remaining calibration: Allen VOR (+109) still trails Gibbs (+170), so pick-1 remains skill-first; slot 3 can still over-draft RB; ESPN 1QB ranks still suppress early QB relative to Superflex ADP

---

## Next planned stages (not started)

1. Better K/DEF scoring when bucket or weekly data exists — do not invent distributions.
2. Horizon 3–4 Monte Carlo and tighter live runtime if 8-candidate 500-sim runs feel slow in a timed draft.
3. Yahoo live draft sync — only after OAuth + pick application is explicitly in scope.
4. Screenshot pick source — later.

Do not treat ESPN rank or Superflex ADP as the final draft answer. The recommendation engine remains the decision layer, now powered by league-adjusted consensus projections.

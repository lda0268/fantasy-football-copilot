# Co-Pilot Start/Sit Engine v1

**AI does not determine Start/Sit recommendations.**

Scores, rankings, eligibility, and lineup assignments are produced by a deterministic engine. There are no OpenAI calls, no model-generated explanations, and no Yahoo write actions.

This document describes the backend engine only. A Start/Sit page is future work. Yahoo lineup writes are future work and are out of scope.

## Purpose

Answer: given the players currently on the user's Yahoo roster, who should occupy each eligible starting lineup slot **this week**?

This is a weekly decision. It is not the waiver engine. Waiver v2 emphasizes rest-of-season value. Start/Sit emphasizes this week's projection, this week's ECR, explicit injury/availability, and Yahoo eligibility.

## Architecture

```
Yahoo roster + Yahoo lineup settings
  → identity reconciliation
  → FantasyPros intelligence
  → Player Intelligence
  → Start/Sit engine (pure)
```

`server/src/startSit/engine.ts` consumes normalized objects only. It does not call Yahoo or FantasyPros HTTP. `server/src/startSit/service.ts` loads providers, then calls the engine.

Read-only endpoint: `GET /api/start-sit`.

## Yahoo authority

Yahoo is authoritative for:

- roster membership
- current `selectedPosition` (starter / BN / IR)
- league roster slot configuration (`roster_positions`)
- player eligibility (`eligiblePositions` / `displayPosition`)
- Yahoo injury/availability flags when present (`status`)

FantasyPros supplies football intelligence. FantasyPros does **not** determine league eligibility.

If Yahoo provides eligibility, FantasyPros position is not used as a substitute.

## Lineup-slot model

League `roster_positions` are parsed from Yahoo-shaped `roster_position` blocks.

Supported starting slot codes:

- `QB`, `RB`, `WR`, `TE`, `K`
- `DEF`, `DST`, `D/ST` (normalized to DEF eligibility)
- `W/R/T`, `FLEX`, `UTIL`
- `W/R`, `WR/RB`
- `Q/W/R/T`, `SUPERFLEX`, `OP`

`BN` / `BENCH` and `IR` / `IR+` / `IL` are not starting slots.

Fixture mode includes a synthetic 1QB / 2RB / 2WR / 1TE / 1 FLEX (`W/R/T`) / 1K / 1DEF / 6BN / 1IR configuration, marked as fixture data. Live mode fetches `league/{key}/settings` and never silently substitutes that fixture.

If live Yahoo does not expose lineup settings, Start/Sit fails closed rather than inventing a universal lineup.

## Position eligibility mapping

Centralized in `server/src/startSit/eligibility.ts`.

A player may fill a slot only when a Yahoo NFL position (from `displayPosition` / `eligiblePositions`) intersects the slot's accepted NFL positions.

FLEX / `W/R/T` accepts RB, WR, TE — not QB. SUPERFLEX / `Q/W/R/T` accepts QB, RB, WR, TE.

## Weekly value formula

Reuse the existing FantasyPros position reference populations and the existing 65% / 35% projection/ECR combiner from Co-Pilot v2 **normalization helpers only**. Waiver v2 scoring weights (need / ROS / health / roster-fit) are not used.

For a **single-position** slot:

1. Weekly projection percentile in that position's FantasyPros weekly projection sample.
2. Weekly ECR percentile in that position's FantasyPros weekly ECR sample (lower ECR is better).
3. Combine with 65% projection + 35% ECR when both exist.
4. If only one signal exists, use that signal. Missing is not zero and not worst rank.

Percentile: `p = (count_strictly_worse + 0.5 * count_equal) / n` (same as v2 reference populations).

Questionable multiplies weekly value by `0.90`. Doubtful multiplies by `0.70`. Out / IR / Suspended are ineligible, not merely penalized.

ROS projection/ECR are not used in weekly value. ROS is not a ranking input.

## Cross-position FLEX method

Position-relative percentiles alone are not used to decide FLEX.

For multi-position slots:

- Weekly projected points are scored against the **union** of all position weekly-projection samples (cross-position absolute signal).
- Weekly ECR remains **position-relative** (never compare raw ECR across QB vs RB vs TE pools).
- Combine with 70% cross-position projection + 30% position ECR when both exist.

That lets a 70th-percentile RB with more projected points outrank an 80th-percentile TE in FLEX.

## Injury / unavailable rules

Sources: Yahoo `status` for every roster player; FantasyPros injury only when identity is `matched`.

Hard-unavailable (cannot be recommended to start):

- Yahoo IR slot (`IR`, `IR+`)
- Yahoo or matched FantasyPros Out / IR / Suspended

Questionable: eligible, explicit warning, 10% value reduction.

Doubtful: eligible, explicit elevated-risk warning, 30% value reduction.

No injury record: unknown. Not Healthy. No availability bonus.

The engine does not diagnose injuries.

## Missing-data behavior

Weekly data completeness (not player quality):

- `strongly_supported`: weekly projection and weekly ECR present
- `supported`: exactly one of those present
- `limited`: neither present

Missing projection ≠ 0. Missing ECR ≠ worst rank. Explicit `0` remains `0`.

## Unresolved identity

Roster players are always preserved. Unresolved identity does not attach FantasyPros weekly/ROS/injury fields. The player remains in current lineup state. Recommendation support is limited.

## Ambiguous identity

Same preservation. Ambiguous identity never attaches guessed FantasyPros data.

## Conservative change policy

An unconstrained optimal assignment is computed first.

A current starter is replaced only when the change is **clear**:

- incoming player is eligible to start
- both players have usable weekly intelligence (`supported` or `strongly_supported`), **or** the current starter is hard-unavailable
- incoming weekly slot value is strictly greater

If the current starter is eligible but lacks usable weekly intelligence (including unresolved/ambiguous identity), the engine keeps that starter and emits `reviewRequired` instead of claiming the bench player is better.

## Optimization algorithm

Dynamic programming over a player occupancy bitmask.

Slots are filled left to right. Each player may occupy at most one slot. Ineligible player/slot pairs are forbidden. Empty slots are allowed only when no unused eligible player remains.

This is exact for typical roster sizes (≤ 22 players). It is not greedy. A FLEX-first greedy assignment can leave a mandatory TE/RB slot with a weaker specialist; the DP considers the full lineup.

No ML. No randomness.

## Tie breakers

When DP states have equal total weekly value:

1. Prefer more current starters remaining in their current slots
2. Stable assignment key (Yahoo player keys in slot order)

A replacement is not emitted on an exact weekly-value tie (current starter preference / less churn).

## Projected-point delta

Move-level `projectedPointsDelta` is `start.weeklyProjectedPoints - sit.weeklyProjectedPoints` only when **both** values exist.

Lineup totals sum known starter projections only. `complete` is true only when every starting slot is filled and has a weekly projection. Summary delta is emitted only when both current and recommended totals are complete. Incomplete totals are not treated as equivalent.

This is not win probability.

## Result model

`GET /api/start-sit` returns `context`, `summary`, `currentLineup`, `recommendedLineup`, `moves`, `reviewRequired`, `bench`, `ir`, and `lineupSettings`.

Moves are proposals only. The endpoint does not change Yahoo lineups.

## Limitations

- Requires Yahoo roster slot configuration
- Weekly value needs a FantasyPros reference sample to normalize; without it a signal is omitted rather than fabricated
- Bye week is not a separate Start/Sit component (Yahoo/FP bye can still appear on Player Intelligence)
- No Start/Sit frontend yet
- No Yahoo lineup writes
- Superflex is supported when Yahoo exposes that slot; the default fixture league is 1QB + FLEX, not Superflex

## Future frontend

A later `/start-sit` page should render current vs recommended lineup, moves, warnings, and review-required rows. It must not re-score players in React.

## Future Yahoo write actions

Applying a recommended lineup would require additional Yahoo OAuth scopes and an explicit user action. That is not implemented. OAuth is unchanged.

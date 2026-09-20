# Regular-season Co-Pilot recommendation engine

Deterministic, explainable, read-only analysis of a Yahoo roster plus free agents.

This engine does **not** call Yahoo parsers, submit transactions, or use Draft Room / external projection datasets.

## Inputs

Normalized domain objects only:

- `YahooRosterPlayer[]` (selected position, eligible positions, injury status, bye week)
- current week (`number | null`)
- `YahooAvailablePlayer[]` from the free-agent collection
- data mode (`fixture` | `live`)

## Exclusions

Candidates are dropped before scoring when any of these is true:

- `ownershipType` is missing
- ownership is waiver (`W`, `waivers`) or owned (`team`, `owned`, `T`)
- player is not a free agent (`FA` / `freeagent` / `freeagents` only)
- `playerKey` or full name already appears on the user roster

Waiver and owned players are never recommended.

## Scoring formula

Weights are in `server/src/copilot/config.ts` (`COPILOT_SCORE_WEIGHTS`). Maximum total is **100**.

| Component | Max | Rule |
|---|---:|---|
| availability | 5 | 5 if ownership is a free agent, else 0 |
| positionNeed | 35 | 35 high / 22 medium / 10 low / 0 if the player does not address a roster need |
| projectedPoints | 25 | min–max normalized **within the same position** among scored candidates who have projections |
| percentOwned | 10 | `percentOwned / 100 * 10` |
| health | 15 | healthy 15 / Q 8 / D 4 / O 1 / IR 0 |
| byeWeek | 10 | 0 if `byeWeek === currentWeek`, else 10 |

```
total = availability + positionNeed + projectedPoints + percentOwned + health + byeWeek
```

Projected points are never compared raw across positions. A QB projection cannot dominate a WR/RB solely because the number is larger.

## Missing-data behavior

- Missing `projectedPoints`: award **12.5** (half of 25) and add a caution. This is **not** treated as zero.
- Explicit `0` / `0.00` projection: score **0**.
- Missing `percentOwned`: award **5** (half of 10) and add a caution.
- Explicit `0` percent owned: score **0**.
- Missing injury status: treated as healthy.
- Missing bye week: no current-week bye penalty.
- Missing current week: bye penalties and bye vulnerabilities are not applied.

## Roster-need rules

Inspected positions: QB, RB, WR, TE, K, DEF.

Selected slots `BN` and `IR` are not starters. IR slots and `status` IR/Out are not healthy active depth.

| Severity | When |
|---|---|
| high | no usable player at the position, or an IR/Out starter with no usable replacement |
| medium | only one healthy usable player; or current-week bye with no replacement; or Q/D starter with no other healthy player |
| low | RB/WR limited to two healthy players; or Q/D starter with a healthy backup |
| (none) | deeper healthy coverage; the position is omitted from `rosterNeeds` |

League roster slot counts are **not** invented. Starter slots are whatever `selectedPosition` values are actually present.

## Injury rules

Yahoo `status` only:

- IR: unusable depth; health score 0
- O / Out: unusable depth; health score 1
- D / Doubtful: still usable; health 4
- Q / Questionable: usable; health 8; not an automatic disqualification
- none: healthy; health 15

No return dates, snap estimates, or injury diagnosis.

## Bye-week rules

A bye matters **only** when `player.byeWeek === currentWeek`.

Future byes are not vulnerabilities and are not candidate penalties.

## Drop safeguards

- Only `selectedPosition === "BN"`
- Never starters
- Never IR-slot players
- Never drop when remaining usable players at that position would fall below 2
- Pair a drop only when the add addresses a **medium or high** need
- If evidence is insufficient: `action = "consider_add"` with no `dropPlayer`

Yahoo roster players do not include `percentOwned` or `projectedPoints` in this codebase. Drops are not ranked by invented projections.

## Deterministic ranking

1. total score descending  
2. position-need component descending  
3. projection component descending  
4. percent-owned component descending  
5. add-player name ascending (`localeCompare`)

Default `limit` is 10; maximum 25.

Waiver/free-agent scoring that consumes Player Intelligence lives in **v2** (`server/docs/copilot-recommendation-engine-v2.md`, `GET /api/copilot/v2/recommendations`). This v1 document remains the Yahoo-only formula.

## Known limitations

- No rest-of-season projections, rankings, or matchup difficulty
- Free-agent pool is capped by the existing FA page size (50)
- Percent owned is a weak supporting signal only
- Same-name roster exclusion is conservative (avoids duplicate fixture identities)
- Does not know official roster-size limits, so add/drop pairing is extra conservative
- Standings and opponent matchup scores are not used in v1
- Draft Room datasets (ESPN, ADP, consensus projections) are intentionally unused

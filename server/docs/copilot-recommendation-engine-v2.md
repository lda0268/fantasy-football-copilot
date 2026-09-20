# Co-Pilot Recommendation Engine v2

**AI does not determine recommendation scores or rankings.**

This engine is deterministic. Rankings come from explicit component scores on `PlayerIntelligence` records. A later explanation layer may restate those scores in natural language, but it must not change them.

## Objective

Answer: *Which players actually available in my Yahoo league would most improve my current roster?*

v2 covers waiver / free-agent **add** recommendations only. It does not execute transactions, analyze trades, or optimize start/sit.

## Architecture

```
provider adapters (Yahoo, FantasyPros)
        ↓
identity reconciliation
        ↓
player intelligence composition
        ↓
FantasyPros position reference distributions (value only)
        ↓
recommendation engine v2 (pure)
        ↓
GET /api/copilot/v2/recommendations
```

The scoring functions do not perform HTTP. `getCopilotRecommendationsV2` loads composed intelligence, the Yahoo roster, and already-normalized FantasyPros projection/ranking arrays, then calls `buildCopilotRecommendationsV2`.

Yahoo availability still determines eligibility. FantasyPros populations are a **value reference set only**.

v1 (`GET /api/copilot/recommendations`) remains Yahoo-only and unchanged in formula.

## Eligibility gate

A player may be an ADD candidate only when Yahoo league state is:

- `free_agent`
- `waivers`

Excluded: `rostered_by_user`, `rostered_by_other`, `unknown`.

FantasyPros availability never overrides Yahoo.

## Identity policy

Preferred candidates have `identity.status = matched`.

- **Ambiguous:** excluded from v2 ranking.
- **Unresolved:** excluded from v2 ranking. No Yahoo-only fallback.

Never guess identity.

## 100-point model

Availability is an eligibility gate, not bonus points.

| Component      | Max | When unavailable |
| -------------- | --: | ---------------- |
| Roster need    |  30 | Always available (Yahoo roster analysis) |
| Rest-of-season |  30 | Score 0, `available: false`, not a fabricated zero projection |
| Weekly value   |  20 | Score 0, `available: false` |
| Health / risk  |  10 | Score 0, `available: false` if no mapped status |
| Roster / bye   |  10 | Score 0, `available: false` if bye missing |

Weights were not tuned against fixture names.

`rawScore` / `score` = rounded sum of the five component scores, capped at 100.

`availableMax` = sum of component maxima where `available === true`. **55 with availableMax 80 is not treated as 69/100.** Ranking uses support tier, then `score`, not score/availableMax.

## Roster need (30)

Reuses `analyzeRosterNeeds`. Positions: QB, RB, WR, TE, K, DEF.

| Severity | Points |
| -------- | -----: |
| high     |     30 |
| medium   |     19 |
| low      |     10 |
| none     |      0 |

## Correlated-signal handling

Weekly projection and weekly ECR are **one** weekly signal. ROS projection and ROS ECR are **one** ROS signal.

When both exist after normalization:

`combined = 0.65 * projectionNorm + 0.35 * ecrNorm`

When only one exists, that signal uses the full component weight. Missing is not invented and is not treated as numeric zero.

## Reference-population construction

For each of weekly projection, weekly ECR, ROS projection, and ROS ECR:

1. Keep rows with a valid numeric value and a normalized NFL position (`DST` → `DEF`).
2. Group by `fantasyProsId`. If an id has **conflicting** values for that signal, omit it (same conservative duplicate rule as composition). Identical duplicates collapse to one value.
3. Build a per-position sample. Positions are never mixed.

Yahoo eligible-candidate counts are **not** used as the football-value sample.

## Exact percentile math

Against the position reference sample of size `n`:

```
p = (count of strictly worse values + 0.5 * count of equal values) / n
```

- Projections: higher is better (worse = smaller).
- ECR: lower is better (worse = larger rank number).
- `p` is in `[0, 1]`.
- Empty sample → that sub-signal cannot be normalized (`undefined`). The component is unavailable if neither sub-signal normalizes.
- The candidate does not have to already appear in the sample.

Component score = `round1(p_combined * componentMax)`.

`components.weeklyValue.normalized` / `restOfSeason.normalized` expose `p_combined`. `referenceSize` is the sample size used.

## Small-pool behavior

Eligible Yahoo `n=1` no longer forces p=0.5. Value is the player's standing in the **FantasyPros position** sample.

If the FantasyPros sample itself has `n=1` and the player matches that one value, p=0.5 is honest (no other reference). If the player is above or below that lone value, p is 1 or 0.

Adding or removing other Yahoo-available players does not change an unchanged player's weekly/ROS normalized football value.

## Missing weekly / ROS

Missing remains missing. The component is `available: false` with score 0 and an explicit “not treated as zero” reason. An actual `0` projection is a real value and is percentile-scored.

## Health missing-data behavior

FantasyPros **status** only. No diagnosis. Absence of evidence is not positive availability evidence.

| Mapped status | Points | Available |
| ------------- | -----: | --------- |
| Healthy / Active / A | 10 | yes |
| Questionable | 5 | yes |
| Doubtful | 2 | yes |
| Out / IR / Suspended | 0 | yes (explicit negative evidence) |
| No injury object | 0 | **no** |
| Unmapped / empty status | 0 | **no** |

No injury record is **not** labeled healthy and does **not** receive a large default health score.

## Bye missing-data behavior

| Situation | Points | Available |
| --------- | -----: | --------- |
| Bye week missing | 0 | **no** (not a penalty, not maximum fit) |
| Bye equals current week | 3 | yes |
| Shares bye with ≥2 rostered players at the same position | 6 | yes |
| Otherwise, bye known | 10 | yes |

## Data / support classification

`dataQuality` is **data support**, not player quality and not probability:

- **strongly_supported:** weekly signal **and** ROS signal present on the intelligence record
- **supported:** weekly **or** ROS present
- **limited:** neither present

Injury/bye completeness is shown on those components, not as a fourth tier.

Limited recommendations include the warning:

`Limited recommendation support: weekly and rest-of-season intelligence are unavailable.`

## Ranking policy

Never random.

1. Support tier (`strongly_supported` > `supported` > `limited`)
2. `score` (same numeric value as `rawScore`) descending
3. ROS component descending
4. Roster need descending
5. Weekly value descending
6. Player name (`localeCompare`)
7. Yahoo player key

A player with no weekly and no ROS intelligence is still returned, but does not rank ahead of a weekly/ROS-supported candidate merely from roster-need or from former default health/bye points.

Limited-data players are not hidden.

## Raw score vs ranking score

`rawScore` and `score` are the same number: the sum of component points. Unavailable components contribute 0 points and are excluded from `availableMax`.

They are **not** a second opaque formula. Ranking order can still differ from raw-point order because **support tier is applied first**.

## Drop candidates

Unchanged safeguards, separate from add ranking: bench only, never starters, never IR, only medium+ add need, leave at least two usable players at the dropped position. No transaction is executed.

## Diagnostic endpoint

`GET /api/copilot/v2/recommendations?limit=`

Returns `context` (week, scoringFormat, providerModes, **referencePopulations**), `summary`, roster needs, vulnerabilities, and recommendations.

Live provider failures are not replaced with fixtures. No secrets are returned.

## Relationship to v1

v1 is Yahoo-only, FA-only, min-max Yahoo projection, missing injury = healthy. v2 uses matched FantasyPros weekly+ROS against position reference populations, includes waivers, and treats missing health/bye as unscored rather than maximum/default positives.

## Limitations

- Fixture FantasyPros samples are small; live samples are expected to be larger. Small upstream `n` still yields coarse percentiles.
- No FAAB / waiver-priority model
- No trade or start/sit engine
- Superflex / league slot counts remain heuristic
- Unresolved identities are omitted
- Reasons are templates, not LLM text

## Future AI explanation layer

An optional layer may narrate the already-computed `components` and `reasons`. **AI does not determine recommendation scores or rankings.**

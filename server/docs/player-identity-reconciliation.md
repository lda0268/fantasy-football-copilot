# Player identity reconciliation

**Unresolved is safer than incorrectly matched.**

This layer answers only: which Yahoo player corresponds to which FantasyPros player, and how was that decided?

It does **not** copy projections, ECR, or injuries onto Yahoo objects. It does not score waivers.

## Architecture

```
Yahoo adapters          FantasyPros adapters
      │                         │
      ▼                         ▼
normalized Yahoo players   normalized FantasyPros players
      │                         │
      └────────► playerIdentity ◄────────┘
                      │
                      ▼
              PlayerIdentityMatch[]
                      │
                      ▼
        later: Player Intelligence Composition Layer
```

- `server/src/playerIdentity/` imports already-normalized domain records.
- The matcher makes **no HTTP requests** and does not depend on Express or raw provider JSON.
- Yahoo and FantasyPros remain unaware of each other.
- Later composition should join on `fantasyProsId` from this mapping instead of mutating `YahooRosterPlayer`.

## Matching hierarchy

1. **External Yahoo ID** — `FantasyPros.externalIds.yahoo === Yahoo playerId`
   - `matched` / `external_id` / `exact`
   - Preferred because FantasyPros already supplies Yahoo IDs (including DST/team defenses such as Arizona Cardinals → yahoo `100022`).
   - If **multiple** FantasyPros records claim the same Yahoo ID: `ambiguous`. Do not pick one.
2. **Normalized name + NFL team + NFL position**
   - Exactly one candidate: `matched` / `name_team_position` / `high`
   - More than one: `ambiguous`
3. **Normalized name + NFL team** (only if step 2 produced zero candidates)
   - Exactly one candidate and no explicit position conflict: `matched` / `name_team` / `medium`
   - Explicit position conflict (e.g. WR vs RB): `unresolved`
   - More than one: `ambiguous`

Otherwise: `unresolved` / `none` / `none`.

FantasyPros rows whose Yahoo external ID is present and **different** from the current Yahoo player are excluded from name fallbacks.

## Name normalization (matching only)

Original names stay on the result (`yahooName`, `fantasyProsName`). Matching uses:

- lowercase, trim, collapse whitespace
- apostrophes unified then removed (`D'Andre` / `D’Andre`)
- hyphens → spaces
- periods and other punctuation stripped
- trailing Jr / Sr / II / III / IV removed
- consecutive single-letter tokens collapsed (`D.J.` / `D. J.`)

**Prohibited:** Levenshtein, embeddings, AI, nicknames, first-name-only, last-name-only, initials as guesses, spelling correction, closest-player fallback.

## Team and position

| Input | Canonical |
|---|---|
| JAX, JAC | JAC |
| WSH, WAS | WAS |
| other abbreviations | uppercased as-is |
| unknown / empty | unknown (not invented) |

| Provider position | Canonical |
|---|---|
| QB RB WR TE K | same |
| DST, DEF, Yahoo team defense | DEF |

FLEX / W/R/T / BN / IR are not NFL positions.

## Ambiguity

Indexes store **arrays** of candidates (Yahoo ID, name, name+team, name+team+position). A Map never overwrites a duplicate. Ambiguous results include explainable `reasons` and omit `fantasyProsId`.

## Diagnostic endpoint

`GET /api/player-identity/reconcile` (read-only)

- Loads Yahoo roster + free agents from the **configured** Yahoo mode (fixture or live).
- Loads FantasyPros players from the **configured** FantasyPros mode (fixture or live).
- Does **not** silently swap fixtures if a live provider fails.

Response shape:

```json
{
  "providers": {
    "yahoo": { "mode": "fixture" },
    "fantasyPros": { "mode": "live" }
  },
  "summary": { "total": 0, "matched": 0, "exact": 0, "high": 0, "medium": 0, "unresolved": 0, "ambiguous": 0 },
  "results": []
}
```

Fictional Yahoo fixtures will usually **not** match live FantasyPros players. That is expected; matching rules are not relaxed for demos. Deterministic overlap is covered by in-memory tests and fixture-vs-fixture data.

Secrets (API keys, OAuth tokens, Authorization headers) are never included.

## Limitations

- No fuzzy or nickname matching
- Team aliases are the explicit map only
- Live Yahoo Fantasy access may still be blocked upstream (`additional_authorization_required`)
- Fixture Yahoo + live FantasyPros will largely report `unresolved`

## Future: Player Intelligence Composition Layer

After identity is stable, a **separate** composition layer can attach FantasyPros projections/ECR/injuries to a Yahoo player **via this mapping**. That layer must not live inside Yahoo or FantasyPros adapters, and must not change identity matching.

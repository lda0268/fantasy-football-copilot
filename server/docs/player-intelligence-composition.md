# Player intelligence composition

**Identity determines who the player is. Composition determines what we know about that player. Recommendation scoring determines what we should do.**

This layer does **not** recommend adds, starts, or drops.

## Architecture

```
Yahoo league state ──┐
                     ├── playerIdentity ── matched fantasyProsId
FantasyPros players ─┘
                     │
                     ▼
              playerIntelligence (this module)
                     │
                     ▼
         future Co-Pilot scoring (not this task)
```

`compose.ts` is pure: it consumes already-normalized records and identity results. It makes no HTTP calls.

## Authority

Yahoo is authoritative for league state:

- availability (`rostered_by_user`, `rostered_by_other`, `free_agent`, `waivers`, `unknown`)
- roster slot
- percent owned
- Yahoo player key / ID

FantasyPros is authoritative for intelligence, **only after identity is matched**:

- weekly projection / weekly ECR
- rest-of-season projection / ROS ECR
- injury and practice fields that the adapter already normalized

FantasyPros never overrides Yahoo availability.

## Identity gate

FantasyPros intelligence is attached only when identity `status === "matched"` (exact, high, or medium).

Unresolved or ambiguous identities keep Yahoo data only, plus a warning:

- `FantasyPros intelligence unavailable because player identity is unresolved.`
- `FantasyPros intelligence withheld because player identity is ambiguous.`

Composition does not re-match names, repair identity, or pick a closest player.

## Missing data

Missing projections, ranks, or injuries stay **undefined**. They are not converted to `0` or `healthy`.

`projectedPoints: 0` is a real zero from FantasyPros.

## Duplicate intelligence

If multiple FantasyPros rows share the same `fantasyProsId` for one dataset (weekly projection, ROS, ECR, injury), that **field** is withheld and a warning is added. Identity status is unchanged.

## Provenance

`provenance.fields` maps composed fields to `yahoo` or `fantasypros`. Availability, roster slot, and percent owned are Yahoo. Projections, ECR, and injury status are FantasyPros.

## Freshness

TTL policy is consumed from the existing FantasyPros cache constants (`players` 24h, weekly projections/ECR 30m, ROS 6h, injuries 15m). Observation timestamps are **not invented**. If an upstream `observedAt` is supplied, `evaluateObservation` can mark `stale`; otherwise freshness entries are omitted.

## Diagnostic endpoint

`GET /api/player-intelligence`

Optional filters (applied after composition): `position`, `availability`, `identityStatus`.

Respects configured provider modes. Live Yahoo 403 is returned as a provider error; fixtures are not substituted.

Yahoo fixture + live FantasyPros will often yield unresolved identities because Yahoo fixtures are fictional. That is expected.

## Limitations / future scoring

Composition does not score players. A later Co-Pilot slice may read `PlayerIntelligence` weekly/ROS/injury fields. Scoring weights stay unchanged until that slice.

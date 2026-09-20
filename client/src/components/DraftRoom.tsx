import { AvailablePlayers, QuickSearch } from "./AvailablePlayers";
import { DraftHistory } from "./DraftHistory";
import { DraftStatus } from "./DraftStatus";
import { MyRoster } from "./MyRoster";
import { PickFlash } from "./PickFlash";
import { QuickDraftList } from "./QuickDraftList";
import { Recommendations } from "./Recommendations";
import { TakeVsWait } from "./TakeVsWait";
import { MonteCarloPanel } from "./MonteCarloPanel";
import { useDraftRoom } from "../hooks/useDraftRoom";
import { ESPN_PPR_EXPERT_LABEL, SUPERFLEX_MARKET_LABEL } from "../types/sources";
import { PROJECTION_SOURCE_LABEL } from "../engine/projections/parseProjectionCsv";

export function DraftRoom() {
  const {
    state,
    searchQuery,
    setSearchQuery,
    positionFilter,
    setPositionFilter,
    searchInputRef,
    pickFeedback,
    filteredPlayers,
    quickPlayers,
    onClock,
    currentRound,
    currentTeamSlot,
    picksUntilUser,
    recommendations,
    playerScores,
    takeVsWait,
    monteCarlo,
    monteCarloRecalculating,
    markDrafted,
    draftTopSearchMatch,
    undoLastPick,
    resetDraft,
    setUserSlot,
  } = useDraftRoom();

  return (
    <div className="draft-room">
      <header className="draft-room-header">
        <div>
          <h1>Fantasy Football Co-Pilot</h1>
          <p className="source-labels">
            Expert: {ESPN_PPR_EXPERT_LABEL} · Market: {SUPERFLEX_MARKET_LABEL} · Projections:{" "}
            {PROJECTION_SOURCE_LABEL}
          </p>
        </div>
        <div className="draft-room-actions">
          <a className="season-link" href="/">
            Regular Season
          </a>
          <button
            className="undo-btn"
            onClick={undoLastPick}
            disabled={state.picks.length === 0}
          >
            Undo Last Pick
          </button>
          <button className="danger" onClick={resetDraft}>
            Reset Draft
          </button>
        </div>
      </header>

      <PickFlash feedback={pickFeedback} />

      <div className="draft-room-grid">
        <div className="column">
          <QuickSearch
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onEnterDraft={draftTopSearchMatch}
            inputRef={searchInputRef}
            positionFilter={positionFilter}
            onPositionFilterChange={setPositionFilter}
          />
          <QuickDraftList players={quickPlayers} onDraftPlayer={markDrafted} />
          <AvailablePlayers
            players={filteredPlayers}
            scores={playerScores}
            onDraftPlayer={markDrafted}
          />
        </div>

        <div className="column">
          <DraftStatus
            currentPick={state.currentPick}
            currentRound={currentRound}
            teamCount={state.teamCount}
            userSlot={state.userSlot}
            picksUntilUser={picksUntilUser}
            currentTeamSlot={currentTeamSlot}
            onClock={onClock}
            onUserSlotChange={setUserSlot}
          />
          <MyRoster roster={state.roster} />
          <DraftHistory picks={state.picks} />
        </div>

        <div className="column">
          <Recommendations recommendations={recommendations} />
          <MonteCarloPanel
            result={monteCarlo}
            recommendations={recommendations}
            recalculating={monteCarloRecalculating}
            showDebug={Boolean(import.meta.env.DEV)}
          />
          <TakeVsWait items={takeVsWait} />
        </div>
      </div>
    </div>
  );
}

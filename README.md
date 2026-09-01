# fantasy-football-copilot
A read-only fantasy football draft assistant that provides live draft recommendations, roster analysis, player availability estimates, and draft strategy support.
# Fantasy Football Co-Pilot

Fantasy Football Co-Pilot is an early-stage fantasy football draft assistant designed to help managers make better decisions during live drafts.

## Purpose

The application provides real-time decision support by combining league context with player rankings, ADP, projections, roster needs, positional scarcity, and draft-state analysis.

The goal is to help answer questions such as:

- Who should I draft right now?
- Which players are likely to remain available at my next pick?
- Should I take a player now or wait another round?
- Is a positional run developing?
- Which position has the greatest opportunity cost if I wait?
- How does a potential pick affect the strength and balance of my roster?

## Yahoo Fantasy Sports Integration

Fantasy Football Co-Pilot is being developed to support read-only Yahoo Fantasy Sports integration.

With user authorization, the application may read data such as:

- Fantasy Football league metadata
- Scoring settings
- Roster positions
- Teams and managers
- Player information
- Draft order
- Draft results and picks, where available

Yahoo data will be accessed only after the user explicitly authorizes access.

The application does not make draft selections, modify rosters, submit transactions, or write changes back to Yahoo Fantasy Sports.

## Current Status

Fantasy Football Co-Pilot is currently in early development and personal testing.

Initial development is focused on:

1. Draft board and available-player tracking
2. ADP and player rankings
3. Roster-aware recommendations
4. Player survival probability
5. Positional-run detection
6. Take-versus-wait analysis
7. Live draft decision support

## Technology

The current application architecture uses:

- React
- TypeScript
- Vite
- Node.js
- Express

## Data and Attribution

Yahoo Fantasy Sports integration is subject to Yahoo API approval and applicable Yahoo developer requirements.

When Yahoo Fantasy Sports data is displayed, the application will provide the required Yahoo Fantasy attribution and branding.

## Development Stage

This project is currently intended for personal use and a small group of early testers.

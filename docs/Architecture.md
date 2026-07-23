# Architecture

AthleteOS is a local-first web application served by a small Node.js API server.

## Layers

- **Application shell:** `index.html` provides the accessible layout, modal, toast, navigation targets, and footer.
- **Browser app:** `src/main.js` renders the UI, coordinates state, and handles user workflows.
- **Data model:** `src/data/defaultState.js` defines seed data, version metadata, and navigation.
- **Utilities:** `src/utils/` contains API, DOM, and storage helpers.
- **Server:** `server.mjs` serves static files and API endpoints.

## Data Persistence

Athlete data is stored in `localStorage` under the `athleteos:*` namespace. Export creates a JSON backup file. The app is designed so a future encrypted database can replace storage helpers without rewriting feature screens.

## AI Boundary

OpenAI API calls happen only on the server. The browser sends event text, source URLs, or certificate image data to local endpoints. API keys are loaded from `.env.local` and are never shipped to the client.

## External Services

- OpenAI Responses API: event and certificate assistance
- Open-Meteo: weather and geocoding

## Failure Strategy

When AI calls are unavailable, event scans use deterministic extraction and certificate scanning returns a manual-review response. User workflows remain usable without API quota.

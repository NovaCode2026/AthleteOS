# AthleteOS – Taekwondo Edition

<p align="center">
  <strong>Professional local-first athlete command center by Nova Code</strong><br>
  Track tournaments, readiness, medals, documents, weight, travel weather, and AI-assisted official-source updates from one polished desktop-style web app.
</p>

<p align="center">
  <a href="https://github.com/NovaCode2026/AthleteOS">Repository</a> |
  <a href="https://github.com/NovaCode2026/AthleteOS/issues">Issues</a> |
  <a href="https://github.com/NovaCode2026/AthleteOS/discussions">Discussions</a>
</p>

## Features

- 🥋 Athlete profile, belt, coach, school, age class, and weight category
- 🧭 Readiness dashboard with competition countdown and training signals
- 🤖 AI Event Watch for official-source summaries and change history
- 🗓️ Calendar for training, weigh-ins, travel, and competition dates
- 🏅 Medal cabinet with certificate-assisted achievement capture
- 🔐 Document vault metadata for medical, identity, and registration records
- ⚖️ Weight tracker with trend visualization
- ✅ Competition checklist with local persistence
- 🌦️ Weather and travel readiness powered by Open-Meteo
- 🔔 Notifications, export, and local sample-data recovery

## Screenshots

Screenshots are organized for release assets:

| View | Capture Target |
| --- | --- |
| Dashboard | `docs/screenshots/dashboard.png` |
| AI Event Watch | `docs/screenshots/event-watch.png` |
| Medal Cabinet | `docs/screenshots/medal-cabinet.png` |
| Mobile Layout | `docs/screenshots/mobile.png` |

## Architecture Overview

AthleteOS is a dependency-light Node.js and browser application. The browser owns the local-first experience and persists user data in `localStorage`. The Node server serves static assets and protects server-only integrations such as OpenAI API calls, source fetching, and weather lookups.

```text
Browser UI -> localStorage
Browser UI -> Node server APIs -> OpenAI Responses API
Browser UI -> Node server APIs -> Open-Meteo APIs
```

See [docs/Architecture.md](docs/Architecture.md) for the detailed design.

## Requirements

- Node.js 18 or newer
- A modern Chromium, Edge, Firefox, or Safari browser
- Optional: `OPENAI_API_KEY` in `.env.local` for live AI summaries

## Installation

```bash
git clone https://github.com/NovaCode2026/AthleteOS.git
cd AthleteOS
npm install
```

This project currently has no third-party runtime dependencies, so `npm install` is mainly for standard npm workflow compatibility.

## Run Locally

```bash
npm start
```

Open `http://localhost:4173`.

To use AI features, create `.env.local`:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

## Folder Structure

```text
AthleteOS/
  .github/              GitHub issue, PR, and discussion templates
  docs/                 Architecture, API, development, and UI docs
  public/               Static public assets
  src/
    assets/             Icon utilities and visual assets
    components/         Future component modules
    data/               Default app data and navigation model
    styles/             Application stylesheet
    utils/              DOM, API, and storage helpers
    main.js             Browser application entrypoint
  index.html            App shell
  server.mjs            Local static/API server
```

## Technology Stack

- JavaScript ES modules
- Node.js HTTP server
- Browser `localStorage`
- CSS Grid, Flexbox, and responsive media queries
- OpenAI Responses API for event and certificate assistance
- Open-Meteo for weather data

## Current Features

AthleteOS v1.0.0 includes the dashboard, event monitoring, local calendar, medal cabinet, document vault, athlete profile, weight tracker, competition checklist, notifications, data export, certificate scanning workflow, weather endpoint, and travel weather UI.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Future Features

- Desktop packaging with Electron or Tauri
- Optional encrypted local database
- Cloud sync and multi-device backup
- OCR fallback for certificate extraction
- Official federation source adapters
- Push notifications and offline-first service worker

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests.

## License

AthleteOS is released under the [MIT License](LICENSE).

## Developer

Developed by **Nova Code**.

Copyright © 2026 Nova Code.

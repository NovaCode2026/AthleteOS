# AthleteOS - Taekwondo Edition

A polished, local-first desktop-style web application for Taekwondo athletes. It implements the V1 master specification: tournament monitoring, readiness dashboard, calendar, medals, document vault, athlete profile, weight tracking and competition checklist.

## Run locally

Prerequisite: Node.js 18 or newer.

```bash
npm start
```

Open `http://localhost:4173`.

## Product decisions

- **Local-first:** user data is persisted in browser `localStorage`; no account or cloud service is required.
- **AI Event Watch:** a safe, deterministic demo scanner demonstrates verified change notifications. Production integrations belong behind an authenticated server-side provider adapter - never place API keys in this client.
- **Portable foundation:** dependency-free ES modules and responsive CSS make the UI easy to wrap with Electron or Tauri for Windows distribution.

## GitHub publishing

Create an empty GitHub repository named `athleteos-taekwondo`, then run:

```bash
git init
git add .
git commit -m "feat: initial AthleteOS Taekwondo edition"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/athleteos-taekwondo.git
git push -u origin main
```

Developed by Nova Code. Copyright 2026 Nova Code.

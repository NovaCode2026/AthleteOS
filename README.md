# AthleteOS – Taekwondo Edition

AthleteOS is a production-ready cloud application for Taekwondo athletes, built by **Nova Code** with React, Vite, Supabase, Netlify, and secure server-side OpenAI functions.

## Features

- Secure Supabase authentication: register, login, logout, forgot password, reset password, email verification, remembered sessions, and protected routes
- Supabase-backed athlete profile, tournaments, matches, medals, certificates, documents, weight logs, calendar, notifications, checklists, injuries, and goals
- Row Level Security so every athlete can only access their own records
- Secure Supabase Storage buckets for profile images, medal images, certificates, and documents
- Server-only OpenAI calls through Netlify Functions
- AI coach workflows for training, tournament preparation, match analysis, nutrition, recovery, goals, reports, and motivation
- Responsive dark UI for desktop, tablet, and mobile
- Dashboard with tournaments, training, weight chart, statistics, medals, quick actions, and goals

## Architecture

```text
React + Vite browser app
  -> Supabase Auth
  -> Supabase Postgres with RLS
  -> Supabase Storage with private bucket policies
  -> Netlify Functions for OpenAI-only secret operations
```

The browser handles rendering, validation, state, and direct Supabase access through the publishable anon key. Secrets never run in the browser.

## Requirements

- Node.js 18+
- Supabase project
- Netlify project
- OpenAI API key configured only in Netlify environment variables

## Environment Variables

Frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Server:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Never expose `OPENAI_API_KEY` or any Supabase service-role key in frontend code.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

For Netlify Functions locally:

```bash
netlify dev
```

## Build

```bash
npm run build
```

## Supabase Setup

Run the SQL files in this order in the Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/policies.sql`
3. `supabase/storage.sql`

Then enable email auth settings and configure the redirect URL for your Netlify domain.

## Netlify Deployment

1. Connect GitHub repo `NovaCode2026/AthleteOS`.
2. Set build command: `npm run build`.
3. Set publish directory: `dist`.
4. Set functions directory: `netlify/functions`.
5. Add all environment variables listed above.
6. Deploy.

## Folder Structure

```text
src/
  App.jsx
  hooks/useAuth.js
  lib/supabase.js
  services/database.js
  data/seed.js
  styles/main.css
netlify/functions/
  ai-coach.mjs
supabase/
  schema.sql
  policies.sql
  storage.sql
docs/
  API.md
  Architecture.md
  Development.md
  UI.md
```

## Manual Steps After Coding

- Create a Supabase project.
- Run `schema.sql`, `policies.sql`, and `storage.sql`.
- Copy Supabase URL and anon key into Netlify and local env files.
- Add `OPENAI_API_KEY` only to Netlify/local server env.
- Configure Supabase auth redirect URLs.
- Deploy on Netlify.

## License

MIT License. Copyright (c) 2026 Nova Code.

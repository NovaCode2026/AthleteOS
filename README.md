# AthleteOS - Taekwondo Edition V2

**AthleteOS** is a production-ready cloud operating system for Taekwondo athletes, built by **Nova Code** with React, TypeScript, Vite, Supabase, Netlify, and secure server-side OpenAI coaching.

## Features

- Secure Supabase authentication: registration, login, logout, email verification, password reset, remembered sessions, and protected routes
- TypeScript V2 app shell with typed plans, athlete data, verification, feedback, roadmap, and usage models
- Supabase-backed athlete profile, academies, academy memberships, training plans, attendance, tournaments, matches, medals, certificates, documents, weight logs, calendar, notifications, checklists, injuries, goals, feedback, verifications, subscriptions, referrals, badges, support tickets, announcements, feature flags, audit logs, and AI usage events
- Row Level Security so athlete-owned records stay private by default
- Student verification workflow for school ID, fee receipt, and bonafide proof
- Plan system: Free, Student, Pro, Champion, and Academy with monthly AI limits
- AI Coach through Netlify Functions so `OPENAI_API_KEY` never ships to the browser
- Payment-provider scaffold for Razorpay, Stripe, and Cashfree
- Admin command-center foundation for users, plans, verifications, feedback, roadmap, badges, support tickets, announcements, feature flags, audit logs, AI usage, academy operations, and analytics
- Responsive Nova Code branded UI for desktop, tablet, and mobile

## Architecture

```text
React + TypeScript + Vite browser app
  -> Supabase Auth
  -> Supabase Postgres with RLS
  -> Supabase Storage private buckets
  -> Netlify Functions for secret server operations
  -> OpenAI Responses API for AI Coach
```

The browser uses only Supabase publishable anon credentials. OpenAI keys, payment secrets, and future webhook secrets belong only in Netlify/server environments.

## Requirements

- Node.js 18+
- Supabase project
- Netlify project
- OpenAI API key configured only in server environment variables

## Environment variables

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

For Netlify production, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be configured in the Netlify site environment before building. Vite embeds `VITE_` variables at build time; production does not read your local `.env.local`.

## Install

```bash
npm install
```

## Run locally

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

## Supabase setup

Run the SQL files in this order in the Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/policies.sql`
3. `supabase/storage.sql`

Then enable email auth and configure redirect URLs for local development and the Netlify production domain.

## Netlify deployment

1. Connect GitHub repo `NovaCode2026/AthleteOS`.
2. Set build command: `npm run build`.
3. Set publish directory: `dist`.
4. Set functions directory: `netlify/functions`.
5. Add environment variables.
6. Deploy.

## Folder structure

```text
src/
  App.tsx
  config/plans.ts
  hooks/useAuth.tsx
  lib/supabase.ts
  services/database.ts
  styles/main.css
  types.ts
netlify/functions/
  ai-coach.mjs
supabase/
  schema.sql
  policies.sql
  storage.sql
docs/
  API.md
  Architecture.md
  Deployment.md
  Development.md
  UI.md
```

## Current V2 modules

- Dashboard
- Athlete profile
- Plans and billing scaffold
- Student verification
- Academy/coach backend foundation
- Tournaments
- Training
- Medals
- Secure documents
- Weight tracking
- Competition checklist
- AI Coach with plan-aware limits
- Feedback portal
- Public roadmap
- Admin command-center foundation
- Support, announcements, feature flags, and audit-log foundations

## Roadmap

- Server-enforced AI quota writes in Netlify Functions
- Payment checkout endpoints for Razorpay, Stripe, and Cashfree
- File upload UI for verification and certificates
- Athlete Resume PDF generator
- Academy roster management
- Coach dashboards, attendance, and training plans
- Support/admin operations and audit reporting
- Realtime notifications and analytics

## License

MIT License. Copyright (c) 2026 Nova Code.

## Developer

Built and maintained by **Nova Code**.

GitHub: [NovaCode2026/AthleteOS](https://github.com/NovaCode2026/AthleteOS)

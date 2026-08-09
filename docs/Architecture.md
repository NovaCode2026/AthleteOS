# Architecture

AthleteOS is a React/TypeScript/Vite cloud application backed by Supabase and deployed on Netlify.

## Layers

- **Application shell:** `index.html` mounts the Vite React app.
- **Browser app:** `src/App.tsx` renders protected routes, dashboard, plans, verification, feedback, roadmap, admin, and athlete feature screens.
- **Auth:** `src/hooks/useAuth.tsx` manages Supabase authentication, email verification state, and session persistence.
- **Data access:** `src/services/database.ts` centralizes Supabase table and storage operations.
- **Plans:** `src/config/plans.ts` defines Free, Student, Pro, Champion, and Academy tiers.
- **Server-only AI:** `netlify/functions/ai-coach.mjs` calls OpenAI without exposing secrets.

## Data Persistence

Athlete data is stored in Supabase Postgres with Row Level Security. V2 adds normalized tables for student verifications, feedback, public roadmap items, AI usage events, subscriptions, referrals, badges, academy memberships, training plans, attendance, support tickets, announcements, feature flags, payment events, and audit logs. Files are stored in private Supabase Storage buckets.

## Role Model

AthleteOS supports athlete, coach, academy admin, support admin, admin, and super admin roles. The UI hides unavailable actions, while database RLS and future Netlify Functions enforce backend authorization.

## AI Boundary

OpenAI API calls happen only on the server. The browser sends event text, source URLs, or certificate image data to local endpoints. API keys are loaded from `.env.local` and are never shipped to the client.

## External Services

- OpenAI Responses API: event and certificate assistance
- Open-Meteo: weather and geocoding

## Failure Strategy

When AI calls are unavailable, event scans use deterministic extraction and certificate scanning returns a manual-review response. User workflows remain usable without API quota.

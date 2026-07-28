# Architecture

AthleteOS is a React/Vite cloud application backed by Supabase and deployed on Netlify.

## Layers

- **Application shell:** `index.html` mounts the Vite React app.
- **Browser app:** `src/App.jsx` renders protected routes, dashboard, and feature screens.
- **Auth:** `src/hooks/useAuth.js` manages Supabase authentication and session persistence.
- **Data access:** `src/services/database.js` centralizes Supabase table and storage operations.
- **Server-only AI:** `netlify/functions/ai-coach.mjs` calls OpenAI without exposing secrets.

## Data Persistence

Athlete data is stored in Supabase Postgres with Row Level Security. Files are stored in private Supabase Storage buckets.

## AI Boundary

OpenAI API calls happen only on the server. The browser sends event text, source URLs, or certificate image data to local endpoints. API keys are loaded from `.env.local` and are never shipped to the client.

## External Services

- OpenAI Responses API: event and certificate assistance
- Open-Meteo: weather and geocoding

## Failure Strategy

When AI calls are unavailable, event scans use deterministic extraction and certificate scanning returns a manual-review response. User workflows remain usable without API quota.

# Deployment Guide

## Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Run `supabase/policies.sql`.
5. Run `supabase/storage.sql`.
6. Enable email authentication.
7. Add your Netlify production URL to Auth redirect URLs.

## Netlify

1. Create a new Netlify site from GitHub.
2. Select `NovaCode2026/AthleteOS`.
3. Use build command `npm run build`.
4. Use publish directory `dist`.
5. Use functions directory `netlify/functions`.

## Environment Variables

Add these in Netlify:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
OPENAI_API_KEY
OPENAI_MODEL
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are frontend-exposed. Do not prefix private values such as `OPENAI_API_KEY`, Supabase service-role keys, payment secrets, or webhook secrets with `VITE_`.

Vite embeds frontend variables at build time. If Netlify is missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, registration and authenticated data loading cannot reach Supabase in production even if local `.env.local` exists.

## Verification

- Register a new user.
- Confirm the email if verification is enabled.
- Add a profile record.
- Add a tournament, training session, medal, and weight log.
- Confirm each table only shows data for the signed-in user.
- Ask the AI coach a training question.

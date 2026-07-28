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

Do not add Supabase service-role keys to the frontend.

## Verification

- Register a new user.
- Confirm the email if verification is enabled.
- Add a profile record.
- Add a tournament, training session, medal, and weight log.
- Confirm each table only shows data for the signed-in user.
- Ask the AI coach a training question.

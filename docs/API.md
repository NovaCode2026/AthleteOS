# API

The production app uses Supabase directly from the browser for authenticated data and Netlify Functions for operations requiring secrets.

## POST `/.netlify/functions/ai-coach`

Calls OpenAI from a server-only Netlify Function.

```json
{
  "topic": "Training Coach",
  "prompt": "Prepare me for a tournament in two weeks."
}
```

All OpenAI requests require `OPENAI_API_KEY` in Netlify environment variables.

## Supabase

Tables and policies are defined in:

- `supabase/schema.sql`
- `supabase/policies.sql`
- `supabase/storage.sql`

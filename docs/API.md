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

## V2 data modules

- `profiles`: athlete profile, role, plan, verified athlete, and founder badge flags
- `student_verifications`: school ID, fee receipt, and bonafide review workflow
- `feedback_items`: user feedback and product triage
- `roadmap_items`: public roadmap entries and votes
- `ai_usage_events`: monthly AI metering foundation
- `subscriptions`: payment-provider subscription scaffold
- `referrals`: referral-code tracking
- `athlete_badges`: XP and badge awards

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

All OpenAI requests require `OPENAI_API_KEY` in Netlify environment variables. The function also requires an authenticated Supabase bearer token and verifies the user's profile/subscription entitlement before calling OpenAI. Free plan users receive zero AI access.

## Supabase

Tables and policies are defined in:

- `supabase/schema.sql`
- `supabase/policies.sql`
- `supabase/storage.sql`

## V2 data modules

- `profiles`: athlete profile, non-admin/admin role, plan, verified athlete, and founder badge flags
- `academies`: academy profile, owner, status, and media metadata
- `academy_memberships`: academy athletes, coaches, and academy admins
- `training_plans`: coach-published training plans
- `attendance_records`: academy attendance and participation history
- `student_verifications`: school ID, fee receipt, and bonafide review workflow
- `feedback_items`: public/private user feedback and product triage
- `roadmap_items`: public roadmap entries and votes
- `ai_usage_events`: monthly AI metering foundation
- `subscriptions`: payment-provider subscription scaffold
- `subscription_usage`: monthly plan and AI usage counters
- `payment_events`: Razorpay, Stripe, Cashfree, and manual billing event audit trail
- `referrals`: referral-code tracking
- `athlete_badges`: XP and badge awards
- `support_tickets`: user support and escalation queue
- `announcements`: platform updates by audience
- `feature_flags`: controlled feature rollout configuration
- `audit_logs`: administrative audit trail

# Deployment Guide

## Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Run `supabase/policies.sql`.
5. Run `supabase/storage.sql`.
6. Enable email authentication.
7. Set the Auth Site URL to the deployed AthleteOS URL.
8. Add these redirect URLs:
   - `https://YOUR-SITE.netlify.app/auth/callback`
   - `https://YOUR-SITE.netlify.app/reset-password`
   - local equivalents for development, such as `http://localhost:5173/auth/callback`
9. Configure the Confirm signup email template using `docs/Supabase_Email_Template.html`.

### First Admin Promotion

Newly registered profiles default to the non-admin `user` role. Do not hardcode an admin email in the app. To create the first admin, a Supabase project owner should verify the trusted user's Auth UID and run this in the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where user_id = 'REPLACE_WITH_TRUSTED_AUTH_USER_ID';
```

Only run this from the Supabase dashboard or a locked server-side maintenance process. Normal authenticated users cannot update `role`, `plan_id`, `verified_athlete`, or `founder_badge` for themselves because the profile trigger preserves those privileged fields unless the acting user is already an admin.

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
SUPABASE_SERVICE_ROLE_KEY
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are frontend-exposed. `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only Netlify Function variables. Do not prefix private values such as OpenAI keys, Supabase service-role keys, payment secrets, or webhook secrets with `VITE_`.

Vite embeds frontend variables at build time. If Netlify is missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, registration and authenticated data loading cannot reach Supabase in production even if local `.env.local` exists.

The manual Tournament Scanner uses the signed-in user's JWT and does not require `SUPABASE_SERVICE_ROLE_KEY`. The scheduled automatic scanner runs server-side every 30 minutes and requires `SUPABASE_SERVICE_ROLE_KEY` to find due scans across users while still keeping source records private in the browser.

## Verification

- Register a new user.
- Confirm the email if verification is enabled.
- Add a profile record.
- Confirm a normal user does not see Admin Panel navigation and receives Access Denied on `/admin`.
- Promote one trusted test user with the SQL above, then confirm `/admin` loads for that account.
- Add a tournament, training session, medal, and weight log.
- Confirm each table only shows data for the signed-in user.
- Confirm Roadmap loads for authenticated users, one vote per feature is enforced, and only admins can create/update/delete roadmap items.
- Confirm Feedback shows public feedback to authenticated users and private feedback only to the owner/admin.
- Ask the AI coach a training question.
- Use Tournament Scanner Check Now and confirm it does not create an AI usage event.
- Confirm scheduled scanner deployment only when `SUPABASE_SERVICE_ROLE_KEY` is present server-side.

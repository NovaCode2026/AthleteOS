# Changelog

All notable changes to AthleteOS are documented here.

## [2.0.0] - 2026-08-01

### Added

- TypeScript V2 application shell with typed domain models for plans, verification, usage, feedback, roadmap, and athlete records.
- Plan catalog for Free, Student, Pro, Champion, and Academy tiers with monthly AI limits.
- Student verification workflow surface for school ID, fee receipt, and bonafide proof.
- Feedback portal, public roadmap, and admin command-center foundations.
- Expanded Supabase schema for verifications, feedback, roadmap items, AI usage events, subscriptions, referrals, and athlete badges.
- RLS policy coverage for V2 user-owned tables plus public roadmap reads.
- Payment-provider scaffold metadata for Razorpay, Stripe, and Cashfree.

### Changed

- Updated the app entrypoint from `src/App.jsx` to `src/App.tsx`.
- Updated auth, Supabase, and data-access modules to typed TypeScript files.
- Updated documentation for AthleteOS V2 deployment, modules, and architecture.

### Validation

- Production Vite build passes.
- OpenAI key remains local/server-only and was not committed.

## [1.0.0] - 2026-07-28

### Added

- React and Vite production application shell.
- Supabase Authentication for register, login, logout, password reset, email verification, persistent sessions, and protected access.
- Supabase data layer for profiles, training sessions, tournaments, matches, medals, certificates, documents, weight logs, calendar events, notifications, checklists, injuries, and goals.
- SQL setup scripts: `supabase/schema.sql`, `supabase/policies.sql`, and `supabase/storage.sql`.
- Private Supabase Storage bucket setup for profile images, medal images, certificates, and documents.
- Secure Netlify Function for OpenAI-powered AI coaching.
- Netlify deployment configuration and deployment guide.
- Responsive dashboard with training, tournaments, medals, goals, and weight chart.

### Changed

- Replaced browser `localStorage` persistence with Supabase-backed persistence.
- Replaced the Node static/API server with Netlify/Vite deployment.
- Updated README and documentation for cloud setup, security, deployment, and architecture.
- Split Vite output into React, Supabase, chart, icon, and app chunks.

### Security

- OpenAI calls now run only in Netlify Functions.
- Supabase Row Level Security restricts records to the owning user.
- `.env.local` remains ignored and secrets are not committed.

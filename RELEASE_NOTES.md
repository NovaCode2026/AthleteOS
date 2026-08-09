# AthleteOS v2.0.0 Release Notes

AthleteOS v2.0.0 upgrades the Taekwondo Edition into a typed, plan-aware, verification-ready production application.

## Highlights

- React + TypeScript + Vite frontend
- Supabase Auth, Postgres, Row Level Security, and private Storage
- Student verification workflow foundation
- Plan tiers with AI usage limits
- Feedback, roadmap, admin, referrals, badges, subscriptions, and AI usage schema
- Academy, coach, attendance, support, announcement, feature-flag, payment-event, and audit-log schema foundations
- Netlify deployment with server-side OpenAI function
- Payment scaffold for Razorpay, Stripe, and Cashfree

## Validation

```bash
pnpm install --frozen-lockfile
pnpm run build
```

The build passes. Recharts remains isolated in its own vendor chunk; Vite may warn that the chart chunk is larger than 500 kB because the charting dependency itself is large.

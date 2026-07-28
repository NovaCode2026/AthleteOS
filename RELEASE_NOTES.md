# AthleteOS v1.0.0 Release Notes

AthleteOS v1.0.0 upgrades the Taekwondo Edition into a cloud-ready production application.

## Highlights

- React + Vite frontend
- Supabase Auth, Postgres, Row Level Security, and private Storage
- Netlify deployment with server-side OpenAI function
- Protected athlete dashboard and cloud-backed feature screens
- SQL scripts for schema, RLS policies, and storage buckets
- Deployment guide for Supabase and Netlify

## Validation

```bash
pnpm install
pnpm run build
```

The build currently passes. Recharts is isolated in its own vendor chunk; Vite may still warn that the chart chunk is larger than 500 kB because the charting dependency itself is large.

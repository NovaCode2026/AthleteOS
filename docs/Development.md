# Development

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Checks

```bash
npm run build
```

This validates the React/Vite production build.

## Environment

Use `.env.local` for local secrets:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

## Project Principles

- Keep secrets server-side.
- Keep UI workflows local-first.
- Prefer explicit state updates and small helper modules.
- Preserve accessible labels and keyboard behavior when adding controls.
- Do not introduce build tooling until it solves a real product need.

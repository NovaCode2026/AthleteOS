# Development

## Setup

```bash
npm install
npm start
```

Open `http://localhost:4173`.

## Checks

```bash
npm test
```

This validates JavaScript syntax for the server and browser entrypoint.

## Environment

Use `.env.local` for local secrets:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
PORT=4173
```

## Project Principles

- Keep secrets server-side.
- Keep UI workflows local-first.
- Prefer explicit state updates and small helper modules.
- Preserve accessible labels and keyboard behavior when adding controls.
- Do not introduce build tooling until it solves a real product need.

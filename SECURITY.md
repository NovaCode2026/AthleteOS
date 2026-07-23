# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |

## Reporting a Vulnerability

Please report security concerns privately before opening a public issue. Include:

- A clear description of the issue
- Steps to reproduce
- Potential impact
- Suggested mitigation if known

## Security Model

AthleteOS is local-first. User data is stored in browser `localStorage`, while API keys must remain server-side in `.env.local`. Never place `OPENAI_API_KEY` or other secrets in client code, screenshots, issue bodies, or commits.

## Responsible Disclosure

Nova Code will review valid reports, prioritize fixes by impact, and credit reporters when appropriate.

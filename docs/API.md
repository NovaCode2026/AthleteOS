# API

The local server exposes JSON endpoints for browser workflows.

## GET `/api/health`

Returns OpenAI configuration status.

```json
{
  "configured": true,
  "model": "gpt-4.1-mini"
}
```

## GET `/api/weather?city=New%20Delhi`

Looks up current weather using Open-Meteo.

```json
{
  "place": "New Delhi, India",
  "current": {
    "temperature_2m": 31.2,
    "apparent_temperature": 34.8,
    "wind_speed_10m": 8.4
  }
}
```

## POST `/api/event-scan`

Analyzes an official event source.

```json
{
  "eventName": "National Taekwondo Championship",
  "sourceUrl": "https://example.org/event-circular",
  "sourceText": "Optional pasted official update text"
}
```

The response contains summary, changes, dates, venue, registration, action items, confidence, scan time, and source metadata.

## POST `/api/certificate-scan`

Extracts achievement details from a certificate image data URL.

```json
{
  "imageData": "data:image/png;base64,..."
}
```

If AI is unavailable, the endpoint returns empty fields with `needsManualReview: true`.

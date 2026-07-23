import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

async function loadLocalEnv() {
  const raw = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map(line => line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key.trim(), value.trim().replace(/^['"]|['"]$/g, "")])
  );
}

const env = { ...(await loadLocalEnv()), ...process.env };
const model = env.OPENAI_MODEL || "gpt-4.1-mini";

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 3_000_000) throw new Error("Request is too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

function requirePublicHttpUrl(value) {
  const url = new URL(value);
  const blockedHost = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname);
  if (!["http:", "https:"].includes(url.protocol) || blockedHost) {
    throw new Error("Use a public http(s) official source URL.");
  }
  return url;
}

async function callOpenAI(input) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to .env.local and restart the server.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input, temperature: 0.2 })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "OpenAI request failed.");
  }

  return result.output_text
    || result.output?.flatMap(item => item.content || []).map(item => item.text || "").join("")
    || "";
}

async function getSourceText({ sourceUrl, sourceText }) {
  if (sourceText?.trim()) return sourceText.trim().slice(0, 100000);
  if (!sourceUrl) throw new Error("Add an official source URL or paste the official update text.");

  const url = requirePublicHttpUrl(sourceUrl);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { "User-Agent": "AthleteOS/1.0 official-update-reader" }
  });

  if (!response.ok) throw new Error(`Official source returned ${response.status}.`);

  return (await response.text())
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100000);
}

function localEventExtraction(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const dates = [...new Set(normalized.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) || [])];
  const registration = (normalized.match(/[^.]{0,90}(?:registration|register)[^.]{0,130}/i) || [""])[0].trim();
  const venue = (normalized.match(/(?:venue|at)\s+([^.,;]{3,100})/i) || ["", ""])[1].trim();

  return {
    summary: "Official update saved. AI summary is unavailable, so review the extracted source details.",
    changes: dates.length ? [`Dates found: ${dates.join(", ")}`] : ["Source content saved for review."],
    dates,
    venue,
    registration,
    actionItems: ["Review the official source before acting on this update."],
    confidence: "needs_review",
    localFallback: true
  };
}

function parseModelJson(value, fallback) {
  try {
    return JSON.parse(value.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return fallback;
  }
}

async function handleHealth(_request, response) {
  sendJson(response, 200, { configured: Boolean(env.OPENAI_API_KEY), model });
}

async function handleWeather(request, response) {
  const city = new URL(request.url, "http://localhost").searchParams.get("city") || "New Delhi";
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geo = await fetch(geoUrl).then(result => result.json());
  const place = geo.results?.[0];

  if (!place) throw new Error("Location not found.");

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`;
  const forecast = await fetch(forecastUrl).then(result => result.json());

  sendJson(response, 200, {
    place: `${place.name}, ${place.country}`,
    current: forecast.current
  });
}

async function handleEventScan(request, response) {
  const data = await readJson(request);
  const text = await getSourceText(data);
  let parsed;

  try {
    const prompt = `You are AthleteOS, a cautious Taekwondo competition assistant. Analyze this official update for the event "${data.eventName || "Taekwondo event"}". Return ONLY valid JSON with keys summary (string, max 60 words), changes (array of concise strings), dates (array), venue (string or empty), registration (string or empty), actionItems (array), confidence (verified|needs_review). Never invent facts. Official update:\n${text}`;
    const result = await callOpenAI(prompt);
    parsed = parseModelJson(result, {
      summary: result,
      changes: [],
      dates: [],
      venue: "",
      registration: "",
      actionItems: [],
      confidence: "needs_review"
    });
  } catch (error) {
    parsed = localEventExtraction(text);
    parsed.aiError = error.message;
  }

  sendJson(response, 200, {
    ...parsed,
    scannedAt: new Date().toISOString(),
    sourceUrl: data.sourceUrl || ""
  });
}

async function handleCertificateScan(request, response) {
  const data = await readJson(request);
  if (!data.imageData) throw new Error("Choose a certificate image first.");

  try {
    const result = await callOpenAI([{
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Extract certificate details. Return ONLY JSON with event, organizer, date, medal, position, category, location. Use empty strings where unavailable. Do not guess."
        },
        { type: "input_image", image_url: data.imageData }
      ]
    }]);

    sendJson(response, 200, parseModelJson(result, {
      event: "",
      organizer: "",
      date: "",
      medal: "",
      position: "",
      category: "",
      location: "",
      raw: result
    }));
  } catch {
    sendJson(response, 200, {
      event: "",
      organizer: "",
      date: "",
      medal: "",
      position: "",
      category: "",
      location: "",
      needsManualReview: true,
      message: "AI extraction is temporarily unavailable. Add the achievement manually after reviewing the certificate."
    });
  }
}

async function handleApi(request, response, path) {
  if (request.method === "GET" && path === "/api/health") return handleHealth(request, response);
  if (request.method === "GET" && path === "/api/weather") return handleWeather(request, response);
  if (request.method === "POST" && path === "/api/event-scan") return handleEventScan(request, response);
  if (request.method === "POST" && path === "/api/certificate-scan") return handleCertificateScan(request, response);
  sendJson(response, 404, { error: "Not found." });
}

async function serveStatic(request, response, path) {
  const relative = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const file = normalize(join(root, relative));

  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const fileStat = await stat(file);
  if (!fileStat.isFile()) throw new Error("Not a file.");

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] || "application/octet-stream"
  });
  response.end(await readFile(file));
}

createServer(async (request, response) => {
  try {
    const path = request.url?.split("?")[0] || "/";
    if (path.startsWith("/api/")) {
      await handleApi(request, response, path);
      return;
    }
    await serveStatic(request, response, path);
  } catch (error) {
    if ((request.url || "").startsWith("/api/")) {
      sendJson(response, 400, { error: error.message || "Request failed." });
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`AthleteOS running at http://localhost:${port}`);
});

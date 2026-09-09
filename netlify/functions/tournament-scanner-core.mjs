import { createHash } from "node:crypto";

export const MAX_RESPONSE_BYTES = 1_500_000;
export const REQUEST_TIMEOUT_MS = 8_000;
export const USER_AGENT = "AthleteOS-TournamentScanner/2.1";

export function normalizeText(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 240);
  }
  return null;
}

export function extractDate(value) {
  if (!value) return null;
  const normalized = value.trim();
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const dmy = normalized.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    const parsed = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function extractPdfLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a[^>]+href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      links.push({ href: new URL(match[1], baseUrl).toString(), label: normalizeText(match[2]).slice(0, 120) || "PDF notice" });
    } catch {
      // Ignore malformed links.
    }
  }
  return links.slice(0, 20);
}

export function scanPage(html, sourceUrl) {
  const text = normalizeText(html);
  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]) || firstMatch(text, [/(?:tournament|championship|open|cup)\s*[:\-]\s*([^|.]{4,120})/i]);

  const dateText = firstMatch(text, [
    /(?:event date|tournament date|dates?)\s*[:\-]\s*([^.;|]{6,80})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/
  ]);

  const registrationText = firstMatch(text, [
    /(?:registration deadline|registration closes|last date(?: for registration)?)\s*[:\-]\s*([^.;|]{6,80})/i
  ]);

  return {
    tournament_name: title,
    tournament_date: extractDate(dateText),
    venue: firstMatch(text, [/(?:venue|location)\s*[:\-]\s*([^.;|]{4,180})/i]),
    registration_deadline: extractDate(registrationText),
    weigh_in_information: firstMatch(text, [/(?:weigh[\s-]?in|weigh-in)\s*[:\-]\s*([^.;|]{4,220})/i]),
    categories: firstMatch(text, [/(?:categories|weight categories|divisions)\s*[:\-]\s*([^.;|]{4,260})/i]),
    notices: firstMatch(text, [/(?:notice|important|announcement)\s*[:\-]\s*([^.;|]{4,260})/i]),
    schedules_results: firstMatch(text, [/(?:schedule|results?)\s*[:\-]\s*([^.;|]{4,260})/i]),
    pdfs: extractPdfLinks(html, sourceUrl)
  };
}

export async function fetchSource(sourceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, text/plain, application/xhtml+xml, application/xml;q=0.9"
      }
    });

    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!/(text\/html|text\/plain|application\/xhtml\+xml|application\/rss\+xml|application\/xml)/.test(contentType)) {
      throw new Error("UNSUPPORTED_CONTENT");
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error("SOURCE_TOO_LARGE");

    const reader = response.body?.getReader();
    if (!reader) return { html: await response.text(), contentType };

    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("SOURCE_TOO_LARGE");
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { html: new TextDecoder().decode(merged), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

export function hashContent(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function nextCheckIso(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

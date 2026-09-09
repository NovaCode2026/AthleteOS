import { createClient } from "@supabase/supabase-js";
import { fetchSource, scanPage } from "./tournament-scanner-core.mjs";

const MAX_RESULTS = 8;
const REQUEST_TIMEOUT_MS = 8_000;

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function createUserSupabaseClient(accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function decodeXml(value = "") {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseNewsRss(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
    const publishedAt = decodeXml(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "").trim();
    if (title && /^https?:\/\//i.test(link)) items.push({ title, link, published_at: publishedAt || null });
  }
  return items.slice(0, MAX_RESULTS);
}

async function fetchRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AthleteOS-TournamentDiscovery/1.0", Accept: "application/rss+xml, application/xml;q=0.9" }
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return parseNewsRss(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function scoreCandidate(result, extracted) {
  const haystack = `${result.title} ${extracted.tournament_name || ""} ${extracted.venue || ""} ${extracted.notices || ""}`.toLowerCase();
  let score = 0;
  for (const word of ["taekwondo", "tournament", "championship", "open", "cup", "entry", "registration", "weigh-in"]) {
    if (haystack.includes(word)) score += word === "taekwondo" ? 4 : 1;
  }
  if (extracted.tournament_date) score += 2;
  if (extracted.registration_deadline) score += 2;
  return score;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json({ error: "Please sign in again before discovering tournaments." }, 401);

  let supabase;
  try { supabase = createUserSupabaseClient(accessToken); } catch { return json({ error: "AthleteOS services are not configured for discovery." }, 503); }
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) return json({ error: "Please sign in again before discovering tournaments." }, 401);

  const body = await request.json().catch(() => ({}));
  const query = String(body.query || "taekwondo tournament India").trim().slice(0, 120);
  if (query.length < 3) return json({ error: "Enter a more specific tournament search." }, 400);

  try {
    const candidates = await fetchRss(query);
    const inspected = await Promise.all(candidates.map(async (candidate) => {
      try {
        const { html } = await fetchSource(candidate.link);
        const extracted = scanPage(html, candidate.link);
        return { ...candidate, ...extracted, relevance_score: scoreCandidate(candidate, extracted) };
      } catch {
        return { ...candidate, relevance_score: scoreCandidate(candidate, {}) };
      }
    }));

    inspected.sort((a, b) => b.relevance_score - a.relevance_score);
    return json({ query, source: "Google News RSS", ai_used: false, results: inspected.slice(0, MAX_RESULTS) });
  } catch {
    return json({ error: "Tournament discovery is temporarily unavailable. Try again shortly." }, 503);
  }
}

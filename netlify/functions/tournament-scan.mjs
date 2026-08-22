import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const planIntervals = {
  free: 12,
  student: 6,
  pro: 3,
  champion: 1,
  academy: 0.5
};

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function createUserSupabaseClient(accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
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

function extractDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function extractPdfLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a[^>]+href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      links.push({
        href: new URL(match[1], baseUrl).toString(),
        label: normalizeText(match[2]).slice(0, 120) || "PDF notice"
      });
    } catch {
      // Ignore malformed links.
    }
  }
  return links.slice(0, 20);
}

function scanPage(html, sourceUrl) {
  const text = normalizeText(html);
  const title = firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) || firstMatch(text, [
    /(?:tournament|championship|open)\s*[:\-]\s*([^|.]{4,120})/i
  ]);
  const date = firstMatch(text, [
    /(?:date|event date)\s*[:\-]\s*([A-Za-z0-9,\s/-]{6,40})/i,
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/
  ]);

  return {
    tournament_name: title,
    tournament_date: extractDate(date),
    venue: firstMatch(text, [/(?:venue|location)\s*[:\-]\s*([^.;]{4,180})/i]),
    registration_deadline: extractDate(firstMatch(text, [/(?:registration deadline|last date)\s*[:\-]\s*([A-Za-z0-9,\s/-]{6,40})/i])),
    weigh_in_information: firstMatch(text, [/(?:weigh[\s-]?in)\s*[:\-]\s*([^.;]{4,220})/i]),
    categories: firstMatch(text, [/(?:categories|weight categories|divisions)\s*[:\-]\s*([^.;]{4,260})/i]),
    notices: firstMatch(text, [/(?:notice|important)\s*[:\-]\s*([^.;]{4,260})/i]),
    schedules_results: firstMatch(text, [/(?:schedule|results?)\s*[:\-]\s*([^.;]{4,260})/i]),
    pdfs: extractPdfLinks(html, sourceUrl)
  };
}

function nextCheckIso(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { sourceUrl } = await request.json().catch(() => ({}));
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return json({ error: "Enter a valid tournament source URL." }, 400);
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return json({ error: "Only http and https tournament sources can be scanned." }, 400);
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json({ error: "Please sign in again before scanning." }, 401);

  let supabase;
  try {
    supabase = createUserSupabaseClient(accessToken);
  } catch {
    return json({ error: "AthleteOS services are not configured for scanning." }, 503);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) return json({ error: "Please sign in again before scanning." }, 401);
  const userId = userData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) return json({ error: "Unable to verify your scanner entitlement." }, 503);
  if (!profile) return json({ error: "Complete onboarding before using Tournament Scanner." }, 403);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  const planId = subscription?.plan_id || profile.plan_id || "free";
  const intervalHours = planIntervals[planId] ?? planIntervals.free;

  const { data: existing } = await supabase
    .from("tournament_scans")
    .select("last_checked_at, source_hash")
    .eq("user_id", userId)
    .eq("source_url", parsedUrl.toString())
    .maybeSingle();

  if (existing?.last_checked_at) {
    const earliest = new Date(existing.last_checked_at).getTime() + intervalHours * 60 * 60 * 1000;
    if (Date.now() < earliest) {
      return json({ error: `This source was checked recently. Your plan allows checks every ${intervalHours === 0.5 ? "30 minutes" : `${intervalHours} hours`}.` }, 429);
    }
  }

  let html = "";
  let status = "checked";
  let extracted = {};
  try {
    const response = await fetch(parsedUrl, {
      headers: { "User-Agent": "AthleteOS-TournamentScanner/1.0" }
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("UNSUPPORTED_CONTENT");
    }
    html = await response.text();
    extracted = scanPage(html, parsedUrl.toString());
  } catch {
    status = "blocked";
    extracted = {
      notices: "AthleteOS could not scan this source automatically. The site may block server requests or use an unsupported file type. Open the source directly or upload the PDF/notice as a document."
    };
  }

  const sourceHash = createHash("sha256").update(html || `${parsedUrl}:${Date.now()}`).digest("hex");
  const changed = existing?.source_hash && existing.source_hash !== sourceHash
    ? "Source content changed since the previous check."
    : "No previous change detected.";

  const { data, error } = await supabase
    .from("tournament_scans")
    .upsert({
      user_id: userId,
      source_url: parsedUrl.toString(),
      ...extracted,
      source_hash: sourceHash,
      detected_changes: changed,
      status,
      last_checked_at: new Date().toISOString(),
      next_check_at: nextCheckIso(intervalHours)
    }, { onConflict: "user_id,source_url" })
    .select()
    .single();

  if (error) return json({ error: "Tournament scan could not be saved." }, 503);
  return json({ scan: data });
}

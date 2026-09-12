import { createClient } from "@supabase/supabase-js";
import { fetchSource, hashContent, nextCheckIso, scanPage } from "./tournament-scanner-core.mjs";

const planIntervals = { free: 12, student: 6, pro: 3, champion: 1, academy: 0.5 };

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
  const canonicalUrl = parsedUrl.toString();

  const { data: existing } = await supabase
    .from("tournament_scans")
    .select("last_checked_at, source_hash")
    .eq("user_id", userId)
    .eq("source_url", canonicalUrl)
    .maybeSingle();

  if (existing?.last_checked_at) {
    const earliest = new Date(existing.last_checked_at).getTime() + intervalHours * 60 * 60 * 1000;
    if (Date.now() < earliest) {
      return json({ error: `This source was checked recently. Your plan allows checks every ${intervalHours === 0.5 ? "30 minutes" : `${intervalHours} hours`}.` }, 429);
    }
  }

  let status = "checked";
  let extracted = {};
  let sourceHash = existing?.source_hash || null;
  try {
    const { html } = await fetchSource(canonicalUrl);
    sourceHash = hashContent(html);
    extracted = scanPage(html, canonicalUrl);
  } catch (error) {
    status = "blocked";
    extracted = {
      notices: error?.message === "SOURCE_TOO_LARGE"
        ? "This source is larger than the scanner safety limit. Use the official notice/PDF directly."
        : "AthleteOS could not scan this source automatically. The site may block server requests, time out, or use an unsupported format."
    };
  }

  const changed = existing?.source_hash && sourceHash && existing.source_hash !== sourceHash
    ? "Source content changed since the previous check."
    : existing?.source_hash
      ? "No changes detected."
      : "First successful source check.";

  const { data, error } = await supabase
    .from("tournament_scans")
    .upsert({
      user_id: userId,
      source_url: canonicalUrl,
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

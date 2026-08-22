import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const batchSize = 25;
const planIntervals = {
  free: 12,
  student: 6,
  pro: 3,
  champion: 1,
  academy: 0.5
};

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function checkSource(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "AthleteOS-TournamentScanner/1.0" }
  });
  if (!response.ok) throw new Error("SOURCE_UNAVAILABLE");
  const html = await response.text();
  const text = normalizeText(html);
  return {
    source_hash: createHash("sha256").update(html).digest("hex"),
    tournament_name: text.match(/(?:tournament|championship|open)\s*[:\-]\s*([^|.]{4,120})/i)?.[1]?.trim() || null,
    notices: text.match(/(?:notice|important)\s*[:\-]\s*([^.;]{4,260})/i)?.[1]?.trim() || null
  };
}

async function getIntervalHours(supabase, userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  const planId = subscription?.plan_id || profile?.plan_id || "free";
  return planIntervals[planId] ?? planIntervals.free;
}

export const config = {
  schedule: "*/30 * * * *"
};

export default async function scheduledHandler() {
  let supabase;
  try {
    supabase = createAdminSupabaseClient();
  } catch {
    return new Response("Tournament scanner is not configured.", { status: 503 });
  }

  const { data: scans, error } = await supabase
    .from("tournament_scans")
    .select("id, user_id, source_url, source_hash, next_check_at")
    .lte("next_check_at", new Date().toISOString())
    .limit(batchSize);

  if (error) return new Response("Unable to load due scans.", { status: 503 });

  for (const scan of scans ?? []) {
    const intervalHours = await getIntervalHours(supabase, scan.user_id);
    try {
      const checked = await checkSource(scan.source_url);
      await supabase
        .from("tournament_scans")
        .update({
          ...checked,
          status: "checked",
          detected_changes: scan.source_hash && scan.source_hash !== checked.source_hash ? "Source content changed since the previous check." : "No changes detected.",
          last_checked_at: new Date().toISOString(),
          next_check_at: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
        })
        .eq("id", scan.id);
    } catch {
      await supabase
        .from("tournament_scans")
        .update({
          status: "blocked",
          detected_changes: "Automatic check could not access this source.",
          last_checked_at: new Date().toISOString(),
          next_check_at: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
        })
        .eq("id", scan.id);
    }
  }

  return new Response(`Checked ${scans?.length ?? 0} tournament sources.`);
}

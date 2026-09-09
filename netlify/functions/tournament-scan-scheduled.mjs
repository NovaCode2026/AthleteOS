import { createClient } from "@supabase/supabase-js";
import { fetchSource, hashContent, nextCheckIso, scanPage } from "./tournament-scanner-core.mjs";

const batchSize = 25;
const concurrency = 5;
const planIntervals = { free: 12, student: 6, pro: 3, champion: 1, academy: 0.5 };

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const config = { schedule: "*/30 * * * *" };

async function runWithConcurrency(items, worker) {
  const results = [];
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

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
    .order("next_check_at", { ascending: true })
    .limit(batchSize);

  if (error) return new Response("Unable to load due scans.", { status: 503 });
  if (!scans?.length) return new Response("Checked 0 tournament sources.");

  const userIds = [...new Set(scans.map((scan) => scan.user_id))];
  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    supabase.from("profiles").select("user_id, plan_id").in("user_id", userIds),
    supabase.from("subscriptions").select("user_id, plan_id, status").in("user_id", userIds).in("status", ["active", "trialing"])
  ]);

  const planByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.plan_id || "free"]));
  for (const subscription of subscriptions ?? []) planByUser.set(subscription.user_id, subscription.plan_id || planByUser.get(subscription.user_id) || "free");

  await runWithConcurrency(scans, async (scan) => {
    const planId = planByUser.get(scan.user_id) || "free";
    const intervalHours = planIntervals[planId] ?? planIntervals.free;
    const checkedAt = new Date().toISOString();

    try {
      const { html } = await fetchSource(scan.source_url);
      const sourceHash = hashContent(html);
      const extracted = scanPage(html, scan.source_url);
      const changed = scan.source_hash && scan.source_hash !== sourceHash ? "Source content changed since the previous check." : scan.source_hash ? "No changes detected." : "First successful source check.";

      await supabase.from("tournament_scans").update({
        ...extracted,
        source_hash: sourceHash,
        status: "checked",
        detected_changes: changed,
        last_checked_at: checkedAt,
        next_check_at: nextCheckIso(intervalHours)
      }).eq("id", scan.id);
    } catch (error) {
      await supabase.from("tournament_scans").update({
        status: "blocked",
        detected_changes: error?.message === "SOURCE_TOO_LARGE" ? "Source exceeded scanner safety limit." : "Automatic check could not access this source.",
        last_checked_at: checkedAt,
        next_check_at: nextCheckIso(intervalHours)
      }).eq("id", scan.id);
    }
  });

  return new Response(`Checked ${scans.length} tournament sources.`);
}

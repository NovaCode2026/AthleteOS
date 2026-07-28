import { requireSupabase } from "../lib/supabase.js";

const TABLES = {
  profile: "profiles",
  training: "training_sessions",
  tournaments: "tournaments",
  matches: "matches",
  medals: "medals",
  certificates: "certificates",
  documents: "documents",
  weights: "weight_logs",
  calendar: "calendar_events",
  notifications: "notifications",
  checklist: "competition_checklists",
  injuries: "injuries",
  goals: "goals"
};

export async function listRows(resource, userId, options = {}) {
  const table = TABLES[resource];
  let query = requireSupabase().from(table).select("*").eq("user_id", userId);
  if (options.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertRow(resource, values) {
  const table = TABLES[resource];
  const { data, error } = await requireSupabase().from(table).upsert(values).select().single();
  if (error) throw error;
  return data;
}

export async function insertRow(resource, values) {
  const table = TABLES[resource];
  const { data, error } = await requireSupabase().from(table).insert(values).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(resource, id, userId) {
  const table = TABLES[resource];
  const { error } = await requireSupabase().from(table).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function uploadPrivateFile(bucket, path, file) {
  const { data, error } = await requireSupabase().storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600"
  });
  if (error) throw error;
  return data.path;
}

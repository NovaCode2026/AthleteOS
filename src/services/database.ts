import { requireSupabase } from "../lib/supabase";

export const TABLES = {
  profile: "profiles",
  academies: "academies",
  academyMemberships: "academy_memberships",
  training: "training_sessions",
  trainingPlans: "training_plans",
  attendance: "attendance_records",
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
  goals: "goals",
  feedback: "feedback_items",
  verifications: "student_verifications",
  roadmap: "roadmap_items",
  roadmapVotes: "roadmap_votes",
  tournamentScans: "tournament_scans",
  referrals: "referrals",
  badges: "athlete_badges",
  aiUsage: "ai_usage_events",
  subscriptions: "subscriptions",
  subscriptionUsage: "subscription_usage",
  paymentEvents: "payment_events",
  supportTickets: "support_tickets",
  announcements: "announcements",
  featureFlags: "feature_flags",
  auditLogs: "audit_logs"
} as const;

export type Resource = keyof typeof TABLES;

function extractDatabaseMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "The database request failed.";
}

function toDatabaseError(resource: Resource, action: string, error: unknown) {
  const detail = extractDatabaseMessage(error);
  const safeDetail = import.meta.env.DEV
    ? ` ${detail}`
    : action === "save"
      ? " Please check the fields and try again."
      : " Please try again later.";
  return new Error(`Unable to ${action} ${resource}.${safeDetail}`);
}

export async function listRows<T>(resource: Resource, userId?: string, options: { order?: string; ascending?: boolean; publicRows?: boolean } = {}) {
  const table = TABLES[resource];
  let query = requireSupabase().from(table).select("*");
  if (!options.publicRows && userId) query = query.eq("user_id", userId);
  if (options.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  const { data, error } = await query;
  if (error) throw toDatabaseError(resource, "load", error);
  return (data ?? []) as T[];
}

export async function upsertRow<T extends Record<string, unknown>>(resource: Resource, values: T, options: { onConflict?: string } = {}) {
  const table = TABLES[resource];
  const query = options.onConflict
    ? requireSupabase().from(table).upsert(values, { onConflict: options.onConflict })
    : requireSupabase().from(table).upsert(values);
  const { data, error } = await query.select().single();
  if (error) throw toDatabaseError(resource, "save", error);
  return data;
}

export async function insertRow<T extends Record<string, unknown>>(resource: Resource, values: T) {
  const table = TABLES[resource];
  const { data, error } = await requireSupabase().from(table).insert(values).select().single();
  if (error) throw toDatabaseError(resource, "save", error);
  return data;
}

export async function deleteRow(resource: Resource, id: string, userId?: string) {
  const table = TABLES[resource];
  let query = requireSupabase().from(table).delete().eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) throw toDatabaseError(resource, "delete", error);
}

export async function updateRow<T extends Record<string, unknown>>(resource: Resource, id: string, values: T, userId?: string) {
  const table = TABLES[resource];
  let query = requireSupabase().from(table).update(values).eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.select().single();
  if (error) throw toDatabaseError(resource, "save", error);
  return data;
}

export async function insertManyRows<T extends Record<string, unknown>>(resource: Resource, values: T[]) {
  const table = TABLES[resource];
  const { data, error } = await requireSupabase().from(table).insert(values).select();
  if (error) throw toDatabaseError(resource, "save", error);
  return data;
}

export async function uploadPrivateFile(bucket: string, path: string, file: File) {
  const { data, error } = await requireSupabase().storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600"
  });
  if (error) throw new Error(import.meta.env.DEV ? error.message : "Unable to upload the file securely. Please try again.");
  return data.path;
}

export async function createSignedFileUrl(bucket: string, path: string) {
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw new Error(import.meta.env.DEV ? error.message : "Unable to open this document right now.");
  return data.signedUrl;
}

export async function deletePrivateFile(bucket: string, path: string) {
  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  if (error) throw new Error(import.meta.env.DEV ? error.message : "Unable to delete the stored file.");
}

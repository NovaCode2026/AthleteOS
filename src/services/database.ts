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

function toDatabaseError(resource: Resource, action: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  return new Error(`Unable to ${action} ${resource}. ${message}`);
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

export async function upsertRow<T extends Record<string, unknown>>(resource: Resource, values: T) {
  const table = TABLES[resource];
  const { data, error } = await requireSupabase().from(table).upsert(values).select().single();
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

export async function uploadPrivateFile(bucket: string, path: string, file: File) {
  const { data, error } = await requireSupabase().storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600"
  });
  if (error) throw error;
  return data.path;
}

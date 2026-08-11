import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

function isValidHttpUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const supabaseConfig = {
  missing: [
    ...(!supabaseUrl ? ["VITE_SUPABASE_URL"] : []),
    ...(!supabaseAnonKey ? ["VITE_SUPABASE_ANON_KEY"] : [])
  ],
  invalid: [
    ...(supabaseUrl && !isValidHttpUrl(supabaseUrl) ? ["VITE_SUPABASE_URL"] : [])
  ]
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseConfig.invalid.length === 0
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    const missing = supabaseConfig.missing.join(", ");
    const invalid = supabaseConfig.invalid.join(", ");
    if (missing) throw new Error(`Supabase is not configured. Missing: ${missing}.`);
    if (invalid) throw new Error(`Supabase is not configured. Invalid: ${invalid}.`);
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

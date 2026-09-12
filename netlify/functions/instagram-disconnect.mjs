import { createClient } from "@supabase/supabase-js";

function env(name) { return Netlify.env.get(name); }
function json(payload, status = 200) { return Response.json(payload, { status }); }

function getServerSupabase() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return null;
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(accessToken);
  return error || !data?.user ? null : data.user;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await authenticate(request);
    if (!user) return json({ error: "Please sign in again." }, 401);
    const supabase = getServerSupabase();
    const { error } = await supabase.from("instagram_connections").delete().eq("user_id", user.id);
    if (error) return json({ error: "Unable to disconnect Instagram." }, 503);
    return json({ disconnected: true });
  } catch (error) {
    console.error("instagram-disconnect", error);
    return json({ error: "Instagram integration is unavailable." }, 503);
  }
}

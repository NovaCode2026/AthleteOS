import { createClient } from "@supabase/supabase-js";

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(accessToken);
  return error || !data?.user ? null : data.user;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  try {
    const user = await authenticate(request);
    if (!user) return json({ error: "Please sign in again." }, 401);

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("instagram_connections")
      .select("instagram_user_id, username, token_expires_at, scopes, status, connected_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return json({ error: "Unable to load Instagram connection status." }, 503);
    if (!data) return json({ connected: false });

    const expired = data.token_expires_at && new Date(data.token_expires_at).getTime() <= Date.now();
    if (expired && data.status === "active") {
      await supabase.from("instagram_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return json({ ...data, status: "expired", connected: false });
    }

    return json({
      connected: data.status === "active",
      instagram_user_id: data.instagram_user_id,
      username: data.username,
      token_expires_at: data.token_expires_at,
      scopes: data.scopes,
      status: data.status,
      connected_at: data.connected_at,
      updated_at: data.updated_at
    });
  } catch (error) {
    console.error("instagram-status", error);
    return json({ error: "Instagram integration is unavailable." }, 503);
  }
}

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function env(name) {
  return Netlify.env.get(name);
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function getServerSupabase() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getUserClient(accessToken) {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json({ error: "Please sign in before connecting Instagram." }, 401);

  const appId = env("INSTAGRAM_APP_ID");
  const redirectUri = env("INSTAGRAM_REDIRECT_URI") || "https://athleteostkd.netlify.app/.netlify/functions/instagram-callback";
  if (!appId || !redirectUri) return json({ error: "Instagram integration is not configured on the server." }, 503);

  try {
    const userSupabase = getUserClient(accessToken);
    const { data, error } = await userSupabase.auth.getUser(accessToken);
    if (error || !data?.user) return json({ error: "Please sign in again before connecting Instagram." }, 401);

    const state = randomBytes(32).toString("hex");
    const supabase = getServerSupabase();
    await supabase.from("instagram_oauth_states").delete().eq("user_id", data.user.id);
    const { error: stateError } = await supabase.from("instagram_oauth_states").insert({
      state,
      user_id: data.user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    if (stateError) return json({ error: "Unable to start Instagram authorization." }, 503);

    const scopes = [
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages"
    ].join(",");

    const authorizeUrl = new URL("https://www.instagram.com/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", appId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("state", state);

    return json({ authorizeUrl: authorizeUrl.toString() });
  } catch (error) {
    console.error("instagram-connect", error);
    return json({ error: "Unable to start Instagram authorization." }, 503);
  }
}

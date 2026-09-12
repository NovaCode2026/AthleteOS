import { createClient } from "@supabase/supabase-js";

const APP_ORIGIN = "https://athleteostkd.netlify.app";

function redirect(path, params = {}) {
  const url = new URL(path, APP_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return Response.redirect(url.toString(), 302);
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function exchangeCode(code, redirectUri) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) throw new Error("INSTAGRAM_SERVER_CONFIG_MISSING");

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token || !payload.user_id) {
    console.error("Instagram token exchange failed", response.status, payload);
    throw new Error("INSTAGRAM_TOKEN_EXCHANGE_FAILED");
  }
  return payload;
}

async function getInstagramProfile(accessToken) {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Instagram profile lookup failed", response.status, payload);
    return {};
  }
  return payload;
}

export default async function handler(request) {
  if (request.method !== "GET") return redirect("/", { instagram: "error", reason: "method" });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error("Instagram authorization denied", error, errorDescription || "");
    return redirect("/", { instagram: "denied" });
  }
  if (!code || !state) return redirect("/", { instagram: "error", reason: "missing_state" });

  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || "https://athleteostkd.netlify.app/.netlify/functions/instagram-callback";

  try {
    const supabase = getServerSupabase();
    const { data: oauthState, error: stateError } = await supabase
      .from("instagram_oauth_states")
      .select("state, user_id, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (stateError || !oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) {
      return redirect("/", { instagram: "error", reason: "invalid_state" });
    }

    // Consume the one-time state before exchanging the code so it cannot be replayed.
    await supabase.from("instagram_oauth_states").delete().eq("state", state);

    const token = await exchangeCode(code, redirectUri);
    const profile = await getInstagramProfile(token.access_token);

    const username = profile.username || null;
    const instagramUserId = String(profile.user_id || token.user_id);
    const scopes = Array.isArray(token.permissions) ? token.permissions : [];

    const { error: saveError } = await supabase.from("instagram_connections").upsert({
      user_id: oauthState.user_id,
      instagram_user_id: instagramUserId,
      username,
      access_token: token.access_token,
      token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      scopes,
      status: "active",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    if (saveError) {
      console.error("Instagram connection save failed", saveError);
      return redirect("/", { instagram: "error", reason: "save_failed" });
    }

    return redirect("/", { instagram: "connected" });
  } catch (error) {
    console.error("instagram-callback", error);
    return redirect("/", { instagram: "error", reason: "callback_failed" });
  }
}

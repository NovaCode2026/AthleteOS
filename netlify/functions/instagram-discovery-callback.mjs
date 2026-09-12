import { createClient } from "@supabase/supabase-js";

function env(name) { return Netlify.env.get(name); }
function serverSupabase() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function redirect(params) {
  const url = new URL("https://athleteostkd.netlify.app/");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

export default async function handler(request) {
  if (request.method !== "GET") return new Response("Method not allowed.", { status: 405 });
  const query = new URL(request.url).searchParams;
  const code = query.get("code");
  const state = query.get("state");
  if (!code || !state) return redirect({ instagram: "discovery-error", reason: "missing_oauth_parameters" });

  try {
    const supabase = serverSupabase();
    const { data: oauthState, error: stateError } = await supabase.from("instagram_discovery_oauth_states")
      .select("state,user_id,expires_at").eq("state", state).maybeSingle();
    if (stateError || !oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) {
      return redirect({ instagram: "discovery-error", reason: "invalid_or_expired_state" });
    }
    await supabase.from("instagram_discovery_oauth_states").delete().eq("state", state);

    const appId = env("INSTAGRAM_APP_ID");
    const appSecret = env("INSTAGRAM_APP_SECRET");
    const redirectUri = env("INSTAGRAM_DISCOVERY_REDIRECT_URI") || "https://athleteostkd.netlify.app/.netlify/functions/instagram-discovery-callback";
    if (!appId || !appSecret) return redirect({ instagram: "discovery-error", reason: "server_not_configured" });

    const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl);
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(`FACEBOOK_TOKEN_EXCHANGE_${tokenResponse.status}`);

    const accessToken = tokenPayload.access_token;
    const meResponse = await fetch(`https://graph.facebook.com/me?fields=id&access_token=${encodeURIComponent(accessToken)}`);
    const mePayload = await meResponse.json().catch(() => ({}));
    if (!meResponse.ok || !mePayload.id) throw new Error("FACEBOOK_USER_LOOKUP_FAILED");

    const pagesResponse = await fetch(`https://graph.facebook.com/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`);
    const pagesPayload = await pagesResponse.json().catch(() => ({}));
    if (!pagesResponse.ok) throw new Error("FACEBOOK_PAGES_LOOKUP_FAILED");
    const page = (pagesPayload.data || []).find((item) => item?.instagram_business_account?.id);
    if (!page) throw new Error("NO_LINKED_INSTAGRAM_PROFESSIONAL_ACCOUNT");

    const expiresIn = Number(tokenPayload.expires_in) || 60 * 24 * 60 * 60;
    const { error: saveError } = await supabase.from("instagram_discovery_connections").upsert({
      user_id: oauthState.user_id,
      facebook_user_id: mePayload.id,
      instagram_user_id: page.instagram_business_account.id,
      instagram_username: page.instagram_business_account.username || null,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;

    return redirect({ instagram: "discovery-connected" });
  } catch (error) {
    console.error("instagram-discovery-callback", error);
    return redirect({ instagram: "discovery-error", reason: error?.message || "callback_failed" });
  }
}

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

async function refreshTokenIfDue(connection, supabase) {
  if (!connection.token_expires_at || !connection.connected_at) return connection.access_token;

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const connectedAt = new Date(connection.connected_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  if (expiresAt - Date.now() > sevenDays || Date.now() - connectedAt < oneDay) {
    return connection.access_token;
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", connection.access_token);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    console.error("Instagram token refresh failed", response.status, payload);
    return connection.access_token;
  }

  const expiresIn = Number(payload.expires_in) || 60 * 24 * 60 * 60;
  await supabase.from("instagram_connections").update({
    access_token: payload.access_token,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    status: "active",
    updated_at: new Date().toISOString()
  }).eq("user_id", connection.user_id);

  return payload.access_token;
}

async function instagramGet(path, accessToken) {
  const url = new URL(`https://graph.instagram.com${path}`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("INSTAGRAM_API_FAILED");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  try {
    const user = await authenticate(request);
    if (!user) return json({ error: "Please sign in again." }, 401);

    const query = new URL(request.url).searchParams;
    const action = query.get("action") || "profile";
    if (!["profile", "media"].includes(action)) return json({ error: "Unsupported Instagram data request." }, 400);

    const supabase = getServerSupabase();
    const { data: connection, error: connectionError } = await supabase
      .from("instagram_connections")
      .select("user_id, instagram_user_id, username, access_token, token_expires_at, connected_at, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError) return json({ error: "Unable to load Instagram connection." }, 503);
    if (!connection || connection.status !== "active") return json({ error: "Connect an Instagram professional account first." }, 404);
    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
      await supabase.from("instagram_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return json({ error: "Instagram authorization expired. Please reconnect Instagram." }, 401);
    }

    const accessToken = await refreshTokenIfDue(connection, supabase);

    if (action === "profile") {
      const profile = await instagramGet("/me?fields=user_id,username", accessToken);
      return json({ profile });
    }

    const media = await instagramGet(`/${encodeURIComponent(connection.instagram_user_id)}/media?fields=id,caption,media_type,media_product_type,media_url,permalink,timestamp&limit=25`, accessToken);
    return json({ media });
  } catch (error) {
    console.error("instagram-data", error?.status || "", error?.payload || error);
    if (error?.status === 401 || error?.status === 190) {
      return json({ error: "Instagram authorization is no longer valid. Please reconnect Instagram." }, 401);
    }
    if (error?.status === 403) return json({ error: "Instagram denied this data request. Check the app permissions and account eligibility." }, 403);
    return json({ error: "Unable to load Instagram data." }, 502);
  }
}

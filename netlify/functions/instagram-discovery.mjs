import { createClient } from "@supabase/supabase-js";

function env(name) { return Netlify.env.get(name); }
function json(payload, status = 200) { return Response.json(payload, { status }); }
function serverSupabase() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function authenticate(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data?.user ? null : data.user;
}
function usernameFromInstagramUrl(raw) {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol) || !/(^|\.)instagram\.com$/i.test(url.hostname)) throw new Error("INVALID_INSTAGRAM_URL");
  const username = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
  if (!username || !/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new Error("INVALID_INSTAGRAM_USERNAME");
  return username;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const user = await authenticate(request);
  if (!user) return json({ error: "Please sign in again." }, 401);

  try {
    const username = usernameFromInstagramUrl(new URL(request.url).searchParams.get("url") || "");
    const supabase = serverSupabase();
    const { data: connection, error } = await supabase.from("instagram_discovery_connections")
      .select("user_id,instagram_user_id,instagram_username,access_token,token_expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "Unable to load Instagram organizer-scanning connection." }, 503);
    if (!connection) return json({ error: "Connect Instagram organizer scanning first." }, 409);
    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
      return json({ error: "Organizer-scanning authorization expired. Please reconnect it." }, 401);
    }

    const fields = [
      "id", "username", "name", "biography", "website", "profile_picture_url", "followers_count", "media_count",
      "media.limit(50){id,caption,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count}"
    ].join(",");
    const apiUrl = new URL(`https://graph.facebook.com/${encodeURIComponent(connection.instagram_user_id)}`);
    apiUrl.searchParams.set("fields", `business_discovery.username(${username}){${fields}}`);
    apiUrl.searchParams.set("access_token", connection.access_token);

    const response = await fetch(apiUrl);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      console.error("instagram-discovery-api", response.status, payload);
      const code = payload?.error?.code;
      if (code === 100 || response.status === 404) return json({ error: "That Instagram account is not available through Business Discovery. It must be a public professional account." }, 404);
      if (response.status === 401 || code === 190) return json({ error: "Instagram organizer-scanning authorization is no longer valid. Please reconnect." }, 401);
      return json({ error: "Instagram Business Discovery rejected the request." }, 502);
    }

    const discovered = payload.business_discovery;
    if (!discovered) return json({ error: "No discoverable Instagram professional account was found." }, 404);
    const posts = discovered.media?.data || [];
    const tournamentPattern = /(taekwondo|kyorugi|tournament|championship|open|national|state|district|selection|cup|games|fight|sparring|registration|entry|weigh[- ]?in|venue|kanpur|ranikhet|haridwar|kotdwar)/i;
    const relevantPosts = posts.filter((post) => tournamentPattern.test(post.caption || ""));

    return json({
      profile: {
        id: discovered.id,
        username: discovered.username,
        name: discovered.name,
        biography: discovered.biography,
        website: discovered.website,
        profile_picture_url: discovered.profile_picture_url,
        followers_count: discovered.followers_count,
        media_count: discovered.media_count
      },
      posts,
      relevantPosts,
      scannedAt: new Date().toISOString()
    });
  } catch (error) {
    if (["INVALID_INSTAGRAM_URL", "INVALID_INSTAGRAM_USERNAME"].includes(error?.message)) return json({ error: "Enter a valid Instagram profile URL, such as https://www.instagram.com/example/" }, 400);
    console.error("instagram-discovery", error);
    return json({ error: "Unable to scan the Instagram organizer profile." }, 502);
  }
}

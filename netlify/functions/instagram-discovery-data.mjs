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
function usernameFromInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://www.instagram.com/${raw.replace(/^@/, "")}/`);
    if (!/instagram\.com$/i.test(url.hostname) && !/\.instagram\.com$/i.test(url.hostname)) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    return first ? first.replace(/^@/, "").slice(0, 80) : null;
  } catch { return raw.replace(/^@/, "").split(/[/?#]/)[0].slice(0, 80) || null; }
}
function tournamentText(post) {
  return `${post?.caption || ""} ${post?.username || ""}`.toLowerCase();
}
function parsePosts(media) {
  const posts = Array.isArray(media) ? media : [];
  const keywords = /(taekwondo|tournament|championship|open|cup|games|kyorugi|registration|weigh|weigh-in|draw|fixture|entry|medal|state|national)/i;
  return posts.filter((post) => keywords.test(tournamentText(post))).map((post) => ({
    id: post.id,
    caption: post.caption || "",
    timestamp: post.timestamp || null,
    permalink: post.permalink || null,
    media_type: post.media_type || null,
    media_url: post.media_url || null
  }));
}
async function graph(path, accessToken) {
  const url = new URL(`https://graph.facebook.com${path}`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `GRAPH_API_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const user = await authenticate(request);
  if (!user) return json({ error: "Please sign in before scanning an organizer." }, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const username = usernameFromInput(body.username || body.url);
    if (!username) return json({ error: "Enter a valid public Instagram profile URL or username." }, 400);

    const supabase = serverSupabase();
    const { data: connection, error: connectionError } = await supabase.from("instagram_discovery_connections")
      .select("instagram_user_id,access_token,token_expires_at,instagram_username,status")
      .eq("user_id", user.id).maybeSingle();
    if (connectionError) return json({ error: "Unable to load Instagram organizer-scanning connection." }, 503);
    if (!connection?.access_token) return json({ error: "Connect an Instagram professional account before scanning organizers." }, 403);
    if (connection.status && connection.status !== "active") return json({ error: "Your Instagram organizer-scanning connection is inactive. Reconnect it." }, 401);
    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) return json({ error: "Your Instagram authorization has expired. Reconnect it." }, 401);

    const fields = "username,name,biography,profile_picture_url,followers_count,media.limit(25){id,caption,media_type,media_product_type,media_url,permalink,timestamp}";
    const encodedUsername = encodeURIComponent(username.replace(/[^a-zA-Z0-9._-]/g, ""));
    const result = await graph(`/${encodeURIComponent(connection.instagram_user_id)}?fields=business_discovery.username(${encodedUsername}){${fields}}`, connection.access_token);
    const target = result?.business_discovery;
    if (!target?.username) return json({ error: "Instagram could not find a matching professional account. Consumer/private accounts cannot be read through Business Discovery." }, 404);

    const media = Array.isArray(target.media?.data) ? target.media.data : [];
    const relevantPosts = parsePosts(media);
    return json({
      organizer: {
        id: target.id || null,
        username: target.username,
        name: target.name || null,
        biography: target.biography || null,
        profile_picture_url: target.profile_picture_url || null,
        followers_count: target.followers_count ?? null
      },
      posts: media,
      relevant_posts: relevantPosts,
      scanned_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("instagram-discovery-data", error?.status || "", error?.message || error);
    if (error?.status === 190 || error?.status === 401) return json({ error: "Instagram authorization is no longer valid. Reconnect your organizer-scanning account." }, 401);
    return json({ error: error?.message || "Instagram organizer scan failed." }, 502);
  }
}

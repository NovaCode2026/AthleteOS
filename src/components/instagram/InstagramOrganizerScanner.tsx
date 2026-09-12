import { useEffect, useState } from "react";
import { ExternalLink, Instagram, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Props = { accessToken?: string; setToast: (toast: { type: "success" | "error" | "warning"; message: string } | null) => void };
type Post = { id: string; caption?: string; media_type?: string; media_url?: string; permalink?: string; timestamp?: string };
type ScanResult = { organizer?: { username?: string; name?: string; biography?: string; profile_picture_url?: string; followers_count?: number }; posts?: Post[]; relevant_posts?: Post[] };

function extractUsername(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://instagram.com/${trimmed}`);
    if (url.hostname.toLowerCase() !== "instagram.com" && !url.hostname.toLowerCase().endsWith(".instagram.com")) return trimmed;
    return url.pathname.split("/").filter(Boolean)[0] || "";
  } catch { return trimmed.split(/[/?#]/)[0]; }
}

export default function InstagramOrganizerScanner({ accessToken, setToast }: Props) {
  const [source, setSource] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function checkConnection() {
    if (!accessToken) return;
    try {
      const response = await fetch("/.netlify/functions/instagram-discovery-status", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.ok) setConnected(Boolean((await response.json() as { connected?: boolean }).connected));
    } catch { /* Scan endpoint remains authoritative. */ }
  }

  useEffect(() => {
    void checkConnection();
    const params = new URLSearchParams(window.location.search);
    if (params.get("instagram") === "discovery-connected") {
      setConnected(true);
      setToast({ type: "success", message: "Instagram organizer scanning is connected." });
      window.history.replaceState(null, "", window.location.pathname);
    } else if (params.get("instagram") === "discovery-error") {
      setToast({ type: "error", message: "Instagram organizer connection could not be completed." });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [accessToken, setToast]);

  async function connect() {
    if (!accessToken) return setToast({ type: "error", message: "Please sign in again before connecting Instagram." });
    setConnecting(true);
    try {
      const response = await fetch("/.netlify/functions/instagram-discovery-connect", { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({})) as { authorizeUrl?: string; error?: string };
      if (!response.ok || !payload.authorizeUrl) throw new Error(payload.error || "Instagram connection could not start.");
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Instagram connection could not start." });
      setConnecting(false);
    }
  }

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    const username = extractUsername(source);
    if (!username) return setToast({ type: "warning", message: "Enter an Instagram organizer username or public profile URL." });
    if (!accessToken) return setToast({ type: "error", message: "Please sign in again before scanning." });
    setScanning(true);
    try {
      const response = await fetch("/.netlify/functions/instagram-discovery-data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ username }) });
      const payload = await response.json().catch(() => ({})) as ScanResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Instagram organizer scan failed.");
      setResult(payload);
      setToast({ type: "success", message: `Instagram scan complete for @${username}.` });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Instagram organizer scan failed." });
    } finally { setScanning(false); }
  }

  const relevant = result?.relevant_posts || [];
  return <div className="feature-page">
    <div className="page-heading"><div><p className="eyebrow">Tournament intelligence</p><h2>Instagram Organizer Scanner</h2></div></div>
    <section className="card scan">
      <span className="scanner"><Instagram className="icon" /></span>
      <div>
        <h3>Scan a tournament organizer's public Instagram</h3>
        <p>Connect a Meta account with a linked professional Instagram. AthleteOS uses Meta Business Discovery for public professional-account information. Consumer accounts are not supported.</p>
        {!connected ? <button className="btn primary" type="button" onClick={() => void connect()} disabled={connecting}><ShieldCheck size={16} /> {connecting ? "Connecting..." : "Connect Meta for organizer scanning"}</button> : <p className="notice" role="status">Meta organizer access is connected.</p>}
        <form className="inline-form" onSubmit={(event) => void scan(event)}>
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="@organizer or https://instagram.com/organizer" required />
          <button className="btn primary" disabled={scanning || !connected}><RefreshCw size={16} /> {scanning ? "Scanning..." : "Scan Instagram"}</button>
        </form>
      </div>
    </section>
    {scanning && <section className="card panel"><Loader2 className="spin" size={18} /> Reading public professional-account data...</section>}
    {result?.organizer && <section className="card panel"><div className="profile-grid">
      {result.organizer.profile_picture_url ? <img src={result.organizer.profile_picture_url} alt="" className="avatar-lg" /> : <div className="avatar-lg">IG</div>}
      <div><h3>@{result.organizer.username}</h3><p>{result.organizer.name || ""}</p><p>{result.organizer.followers_count ? `${result.organizer.followers_count.toLocaleString()} followers` : ""}</p><p>{result.organizer.biography || "No bio returned."}</p></div>
    </div></section>}
    {result && <section className="card panel"><h3>Tournament-relevant posts ({relevant.length})</h3>
      {!relevant.length && <p>No tournament keywords were found in the returned recent posts.</p>}
      {relevant.map((post) => <article key={post.id} className="scan-result-row"><div><strong>{post.timestamp ? new Date(post.timestamp).toLocaleString() : "Recent post"}</strong><p>{post.caption || "No caption returned."}</p></div>{post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" aria-label="Open Instagram post"><ExternalLink size={16} /></a>}</article>)}
    </section>}
  </div>;
}

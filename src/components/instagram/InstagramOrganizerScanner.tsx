import { useEffect, useState } from "react";
import { Globe, Instagram, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

type SourceType = "website" | "instagram";
type Props = {
  accessToken?: string;
  setToast: (toast: { type: "success" | "error" | "warning"; message: string } | null) => void;
};

type ScanRow = {
  id: string;
  source_url: string;
  tournament_name?: string | null;
  tournament_date?: string | null;
  venue?: string | null;
  status?: string | null;
  detected_changes?: string | null;
  last_checked_at?: string | null;
};

type InstagramResult = {
  organizer?: {
    username?: string;
    name?: string | null;
    biography?: string | null;
    followers_count?: number | null;
  };
  relevant_posts?: Array<{
    id: string;
    caption?: string;
    timestamp?: string | null;
    permalink?: string | null;
  }>;
};

function extractInstagramUsername(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://instagram.com/${trimmed}`);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) return "";
    return url.pathname.split("/").filter(Boolean)[0] || "";
  } catch {
    return trimmed.split(/[/?#]/)[0];
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function InstagramOrganizerScanner({ accessToken, setToast }: Props) {
  const [sourceType, setSourceType] = useState<SourceType>("website");
  const [source, setSource] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [instagramResult, setInstagramResult] = useState<InstagramResult | null>(null);

  async function loadScans() {
    if (!accessToken) return;
    const { data: userData } = await supabase.auth.getUser(accessToken);
    const userId = userData.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from("tournament_scans")
      .select("id,source_url,tournament_name,tournament_date,venue,status,detected_changes,last_checked_at")
      .eq("user_id", userId)
      .order("last_checked_at", { ascending: false })
      .limit(20);

    setScans((data || []) as ScanRow[]);
  }

  useEffect(() => {
    void loadScans();
  }, [accessToken]);

  async function scanWebsite(url: string) {
    const response = await fetch("/.netlify/functions/tournament-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ sourceUrl: url })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Website tournament scan failed.");
    return payload;
  }

  async function scanInstagram(value: string) {
    const username = extractInstagramUsername(value);
    if (!username) throw new Error("Enter a valid Instagram profile URL or username.");

    // Preferred route: Meta Business Discovery when an authorized professional account is available.
    const response = await fetch("/.netlify/functions/instagram-discovery-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ username })
    });
    const payload = await response.json().catch(() => ({})) as InstagramResult & { error?: string };

    if (response.ok) {
      setInstagramResult(payload);
      return payload;
    }

    // No connected professional account? Fall back to the same public-source scanner used for websites.
    // Instagram may block server-side reads; in that case the scanner reports the source as blocked rather than faking a result.
    if (response.status === 401 || response.status === 403 || /professional|connect|authorization/i.test(payload.error || "")) {
      setInstagramResult(null);
      return scanWebsite(`https://www.instagram.com/${username}/`);
    }

    throw new Error(payload.error || "Instagram organizer scan failed.");
  }

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      setToast({ type: "error", message: "Please sign in again before scanning." });
      return;
    }
    if (!source.trim()) {
      setToast({ type: "warning", message: "Enter a source link first." });
      return;
    }

    setScanning(true);
    try {
      if (sourceType === "website") {
        await scanWebsite(source.trim());
        setInstagramResult(null);
        setToast({ type: "success", message: "Website tournament scan completed." });
      } else {
        const username = extractInstagramUsername(source);
        const result = await scanInstagram(source.trim());
        if (result?.organizer?.username) {
          setToast({ type: "success", message: `Instagram scan completed for @${username}.` });
        } else {
          setToast({ type: "success", message: `Instagram source scan completed for @${username}.` });
        }
      }
      setSource("");
      await loadScans();
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Tournament scan failed."
      });
    } finally {
      setScanning(false);
    }
  }

  const relevantPosts = instagramResult?.relevant_posts || [];

  return (
    <div className="feature-page unified-tournament-scanner">
      <style>{`
        .feature-page:has(+ .unified-tournament-scanner) { display: none !important; }
        .unified-tournament-scanner .scanner-source-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
        .unified-tournament-scanner .source-option { appearance: none; border: 1px solid rgba(255,255,255,.14); border-radius: 14px; background: rgba(255,255,255,.035); color: inherit; padding: 15px; display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer; }
        .unified-tournament-scanner .source-option.active { border-color: rgba(0,174,255,.8); background: rgba(0,174,255,.1); }
        .unified-tournament-scanner .source-option span { display: grid; gap: 3px; }
        .unified-tournament-scanner .source-option small { opacity: .68; }
        .unified-tournament-scanner .scanner-help { display: flex; align-items: flex-start; gap: 8px; opacity: .72; margin-top: 10px; }
        .unified-tournament-scanner .scan-results { margin-top: 18px; overflow-x: auto; }
        .unified-tournament-scanner table { width: 100%; border-collapse: collapse; }
        .unified-tournament-scanner th, .unified-tournament-scanner td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.08); text-align: left; white-space: nowrap; }
        .unified-tournament-scanner .instagram-post { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
        @media (max-width: 700px) { .unified-tournament-scanner .scanner-source-picker { grid-template-columns: 1fr; } }
      `}</style>

      <div className="page-heading">
        <div>
          <p className="eyebrow">Tournament intelligence</p>
          <h2>Tournament Scanner</h2>
          <p>Choose what the link is from, then scan it. AthleteOS keeps Website and Instagram scanning in one place.</p>
        </div>
      </div>

      <section className="card scan">
        <div className="scanner-source-picker" role="tablist" aria-label="Tournament source type">
          <button type="button" className={`source-option ${sourceType === "website" ? "active" : ""}`} onClick={() => setSourceType("website")} aria-selected={sourceType === "website"}>
            <Globe size={20} />
            <span><strong>Website</strong><small>Tournament site, notice, schedule or PDF</small></span>
          </button>
          <button type="button" className={`source-option ${sourceType === "instagram" ? "active" : ""}`} onClick={() => setSourceType("instagram")} aria-selected={sourceType === "instagram"}>
            <Instagram size={20} />
            <span><strong>Instagram</strong><small>Organizer profile or @username</small></span>
          </button>
        </div>

        <form className="inline-form" onSubmit={(event) => void scan(event)}>
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={sourceType === "website" ? "https://example.com/tournament" : "@organizer or https://instagram.com/organizer"}
            aria-label={sourceType === "website" ? "Tournament website URL" : "Instagram organizer profile"}
            required
          />
          <button className="btn primary" type="submit" disabled={scanning}>
            {scanning ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </form>

        {sourceType === "website" ? (
          <p className="scanner-help"><Globe size={16} /> Website scanning follows relevant tournament pages, notices, schedules, results and linked PDFs.</p>
        ) : (
          <p className="scanner-help"><ShieldCheck size={16} /> Professional organizer accounts can use Meta Business Discovery. Public consumer profiles do not require the AthleteOS user to connect a Business account; access may still be limited by Instagram.</p>
        )}
      </section>

      {instagramResult?.organizer && (
        <section className="card panel">
          <h3>@{instagramResult.organizer.username}</h3>
          <p>{instagramResult.organizer.name || ""}</p>
          {instagramResult.organizer.followers_count != null && <p>{instagramResult.organizer.followers_count.toLocaleString()} followers</p>}
          <p>{instagramResult.organizer.biography || "No bio returned."}</p>
          {relevantPosts.length > 0 && (
            <div>
              <h4>Tournament-relevant posts ({relevantPosts.length})</h4>
              {relevantPosts.map((post) => <article key={post.id} className="instagram-post"><strong>{formatDate(post.timestamp)}</strong><p>{post.caption || "No caption returned."}</p>{post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer">Open Instagram post</a>}</article>)}
            </div>
          )}
        </section>
      )}

      <section className="card panel scan-results">
        <h3>Saved scans</h3>
        {!scans.length ? <p>No tournament scans yet. Choose a source above and run your first scan.</p> : (
          <table>
            <thead><tr><th>Source</th><th>Tournament</th><th>Date</th><th>Venue</th><th>Last checked</th><th>Changes</th><th>Status</th></tr></thead>
            <tbody>
              {scans.map((scanRow) => (
                <tr key={scanRow.id}>
                  <td>{scanRow.source_url}</td>
                  <td>{scanRow.tournament_name || "—"}</td>
                  <td>{scanRow.tournament_date || "—"}</td>
                  <td>{scanRow.venue || "—"}</td>
                  <td>{formatDate(scanRow.last_checked_at)}</td>
                  <td>{scanRow.detected_changes || "—"}</td>
                  <td>{scanRow.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

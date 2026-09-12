import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Calendar, CheckCircle2, ChevronDown, ChevronUp, FileText, RefreshCw, Target, Trophy, Weight } from "lucide-react";
import type { CloudData } from "../../types";
import { calculateReadiness } from "../../lib/readiness";
import { supabase } from "../../lib/supabase";
import { listRows } from "../../services/database";
import "../../styles/command-center.css";

type Props = { data: CloudData; onRefresh?: () => Promise<void> };
type Factor = { label: string; score: number; weight: number };

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function getFactors(data: CloudData): Factor[] {
  const p = data.profile || {};
  const profileFields = [p.full_name, p.date_of_birth, p.weight_kg, p.height_cm, p.belt, p.academy, p.coach];
  const profile = profileFields.filter((v) => v !== undefined && v !== null && String(v).trim() !== "").length / profileFields.length;
  const training = Math.min(1, data.training.length / 8);
  const tournaments = Math.min(1, data.tournaments.length / 3);
  const checklist = data.checklist.length ? data.checklist.filter((x) => x.completed || (x as any).is_completed).length / data.checklist.length : 0;
  const goals = data.goals.length ? data.goals.reduce((sum, x) => sum + Math.max(0, Math.min(100, x.progress || 0)), 0) / data.goals.length / 100 : 0;
  const verification = data.verifications.some((x) => String(x.status || "").toLowerCase() === "approved") ? 1 : 0;
  const documents = Math.min(1, data.documents.length / 3);
  const activity = data.training.length || data.medals.length || data.weights.length ? 1 : 0;
  return [
    { label: "Profile", score: clamp(profile * 100), weight: 20 },
    { label: "Training", score: clamp(training * 100), weight: 20 },
    { label: "Competition", score: clamp(tournaments * 100), weight: 15 },
    { label: "Checklist", score: clamp(checklist * 100), weight: 15 },
    { label: "Goals", score: clamp(goals * 100), weight: 10 },
    { label: "Verification", score: clamp(verification * 100), weight: 10 },
    { label: "Documents", score: clamp(documents * 100), weight: 5 },
    { label: "Activity", score: clamp(activity * 100), weight: 5 },
  ];
}

export default function AthleteCommandCenter({ data, onRefresh }: Props) {
  const [liveData, setLiveData] = useState<CloudData>(data);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"live" | "syncing" | "offline">("live");

  const readiness = calculateReadiness(liveData);
  const factors = useMemo(() => getFactors(liveData), [liveData]);
  const unread = liveData.notifications.filter((n) => !n.read_at);
  const nextTournament = [...liveData.tournaments]
    .filter((t) => t.starts_at && new Date(t.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];
  const pending = liveData.checklist.filter((x) => !x.completed && !(x as any).is_completed).slice(0, 3);

  useEffect(() => {
    setLiveData(data);
    setUpdatedAt(new Date());
  }, [data]);

  useEffect(() => {
    const userId = data.profile.user_id;
    if (!supabase || !userId) {
      setLiveStatus("offline");
      return;
    }

    let disposed = false;

    async function syncReadiness() {
      if (disposed) return;
      setLiveStatus("syncing");
      try {
        const [profiles, tournaments, training, goals, checklist, documents, verifications, weights, medals] = await Promise.all([
          listRows<CloudData["profile"]>("profile", userId),
          listRows<CloudData["tournaments"][number]>("tournaments", userId, { order: "starts_at", ascending: true }),
          listRows<CloudData["training"][number]>("training", userId, { order: "session_date", ascending: false }),
          listRows<CloudData["goals"][number]>("goals", userId, { order: "target_date", ascending: true }),
          listRows<CloudData["checklist"][number]>("checklist", userId),
          listRows<CloudData["documents"][number]>("documents", userId, { order: "created_at" }),
          listRows<CloudData["verifications"][number]>("verifications", userId, { order: "created_at" }),
          listRows<CloudData["weights"][number]>("weights", userId, { order: "logged_at", ascending: true }),
          listRows<CloudData["medals"][number]>("medals", userId, { order: "awarded_at", ascending: false })
        ]);

        if (disposed) return;
        setLiveData((current) => ({
          ...current,
          profile: profiles[0] || current.profile,
          tournaments,
          training,
          goals,
          checklist,
          documents,
          verifications,
          weights,
          medals
        }));
        setUpdatedAt(new Date());
        setLiveStatus("live");
      } catch {
        if (!disposed) setLiveStatus("offline");
      }
    }

    const tables = [
      "profiles",
      "training_sessions",
      "tournaments",
      "goals",
      "competition_checklists",
      "documents",
      "student_verifications",
      "weight_logs",
      "medals"
    ];
    const channel = supabase.channel(`athlete-command-center-${userId}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        () => { void syncReadiness(); }
      );
    });
    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setLiveStatus("live");
        void syncReadiness();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setLiveStatus("offline");
      }
    });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [data.profile.user_id]);

  async function refreshDashboard() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      else setLiveStatus("syncing");
      setUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  const activities = [
    ...liveData.training.map((x) => ({ at: x.session_date, label: `Training: ${x.title}`, icon: Activity })),
    ...liveData.medals.map((x) => ({ at: x.awarded_at, label: `Medal: ${x.event_name}`, icon: Trophy })),
    ...liveData.documents.map((x) => ({ at: x.issued_at, label: `Document: ${x.title}`, icon: FileText })),
  ].filter((x) => x.at).sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime()).slice(0, 6);

  function toggle(label: string) { setExpanded((current) => current === label ? null : label); }

  return <div className="athlete-command-center">
    <section className="readiness-section">
      <article className="card panel readiness-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Live readiness</span>
            <h3>{readiness}% ready <span className={`readiness-live-status ${liveStatus === "syncing" ? "syncing" : ""}`}>{liveStatus === "live" ? "Live" : liveStatus === "syncing" ? "Syncing" : "Offline"}</span></h3>
          </div>
          <div className="command-controls">
            <button type="button" className="icon-btn" onClick={() => void refreshDashboard()} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw className={refreshing ? "spin" : ""} size={17} /></button>
            <Target />
          </div>
        </div>

        <div className="readiness-card-top">
          <div>
            <button type="button" className="readiness-ring readiness-ring-button" onClick={() => toggle("readiness")} aria-expanded={expanded === "readiness"}>
              <strong>{readiness}%</strong><span>overall</span>{expanded === "readiness" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <div className="readiness-meta"><span>Calculated from live athlete data</span><span>Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            {expanded === "readiness" && <p>Readiness updates when supported athlete records change in Supabase Realtime.</p>}
          </div>
          <div className="factor-list">
            {factors.map((factor) => <button type="button" className="factor factor-button" key={factor.label} onClick={() => toggle(factor.label)} aria-expanded={expanded === factor.label}>
              <div><span>{factor.label}</span><b>{factor.score}%</b></div>
              <i><em style={{ width: `${factor.score}%` }} /></i>
              {expanded === factor.label && <small>{factor.score >= 100 ? "This area is complete." : `There is room to improve this area. ${factor.weight}% of readiness is assigned here.`}</small>}
            </button>)}
          </div>
        </div>
      </article>
    </section>

    <section className="interactive-grid">
      <article className="card panel today-card">
        <div className="section-heading"><div><span className="eyebrow">Today</span><h3>Command center</h3></div><Calendar /></div>
        {nextTournament ? <button type="button" className="command-item command-button" onClick={() => toggle("tournament")}><Trophy /><div><strong>Next tournament</strong><span>{nextTournament.name} · {new Date(nextTournament.starts_at!).toLocaleDateString()}</span>{expanded === "tournament" && <small>Tap to review tournament preparation in Tournaments.</small>}</div>{expanded === "tournament" ? <ChevronUp /> : <ChevronDown />}</button> : <div className="empty"><strong>No upcoming tournament</strong><span>Add your next competition to track preparation.</span></div>}
        <button type="button" className="command-item command-button" onClick={() => toggle("checklist")}><CheckCircle2 /><div><strong>{pending.length} checklist items pending</strong><span>{pending[0]?.item || "Everything currently marked complete."}</span>{expanded === "checklist" && pending.length > 1 && <small>{pending.slice(1).map((x) => x.item).join(" • ")}</small>}</div>{expanded === "checklist" ? <ChevronUp /> : <ChevronDown />}</button>
        <button type="button" className="command-item command-button" onClick={() => toggle("weight")}><Weight /><div><strong>Latest weight</strong><span>{liveData.weights.at(-1)?.weight_kg ?? liveData.profile.weight_kg ?? "—"} kg</span>{expanded === "weight" && <small>{liveData.weights.length ? `Tracking ${liveData.weights.length} weight entries.` : "No weight entries yet."}</small>}</div>{expanded === "weight" ? <ChevronUp /> : <ChevronDown />}</button>
        <button type="button" className="command-item command-button" onClick={() => toggle("notifications")}><Bell /><div><strong>{unread.length} unread notifications</strong><span>{unread[0]?.title || "You're all caught up."}</span>{expanded === "notifications" && unread.length > 1 && <small>{unread.slice(1, 4).map((x) => x.title).join(" • ")}</small>}</div>{expanded === "notifications" ? <ChevronUp /> : <ChevronDown />}</button>
      </article>

      <article className="card panel">
        <div className="section-heading"><div><span className="eyebrow">Timeline</span><h3>Recent activity</h3></div><Activity /></div>
        {activities.length ? <div className="timeline">{activities.map((item, index) => { const Icon = item.icon; return <button type="button" className="timeline-item timeline-button" key={`${item.label}-${index}`} onClick={() => toggle(`activity-${index}`)}><Icon size={16} /><div><strong>{item.label}</strong><span>{new Date(item.at!).toLocaleString()}</span>{expanded === `activity-${index}` && <small>Live dashboard data is refreshed from Supabase when records change.</small>}</div>{expanded === `activity-${index}` ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>; })}</div> : <div className="empty"><strong>No activity yet</strong><span>Log training, medals, weights, or documents to build your timeline.</span></div>}
      </article>

      <article className="card panel">
        <div className="section-heading"><div><span className="eyebrow">Next actions</span><h3>Close the gaps</h3></div><CheckCircle2 /></div>
        <ul className="action-list">{factors.filter((x) => x.score < 100).sort((a, b) => a.score - b.score).slice(0, 5).map((factor) => <li key={factor.label}><button type="button" className="action-button" onClick={() => toggle(`action-${factor.label}`)}><span>{factor.label} is at {factor.score}%</span><b>+{Math.round((100 - factor.score) * factor.weight / 100)} pts potential</b></button>{expanded === `action-${factor.label}` && <small>Review this area in the matching AthleteOS section.</small>}</li>)}{!factors.some((x) => x.score < 100) && <li><span>All readiness areas are complete.</span><b>100%</b></li>}</ul>
      </article>
    </section>
  </div>;
}

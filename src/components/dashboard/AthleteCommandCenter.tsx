import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Calendar, CheckCircle2, FileText, Target, Trophy, Weight } from "lucide-react";
import type { CloudData } from "../../types";
import { calculateReadiness } from "../../lib/readiness";
import { supabase } from "../../lib/supabase";

type Props = { data: CloudData; onRefresh?: () => Promise<void> };

type Factor = { label: string; score: number; weight: number };

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function getFactors(data: CloudData): Factor[] {
  const p = data.profile || {};
  const profileFields = [p.full_name, p.date_of_birth, p.weight_kg, p.height_cm, p.belt, p.academy, p.coach];
  const profile = profileFields.filter((v) => v !== undefined && v !== null && String(v).trim() !== "").length / profileFields.length;
  const training = Math.min(1, data.training.length / 8);
  const tournaments = Math.min(1, data.tournaments.length / 3);
  const checklist = data.checklist.length ? data.checklist.filter((x) => x.completed).length / data.checklist.length : 0;
  const goals = data.goals.length ? data.goals.reduce((sum, x) => sum + Math.max(0, Math.min(100, x.progress || 0)), 0) / data.goals.length / 100 : 0;
  const verification = data.verifications.some((x) => x.status === "approved") ? 1 : 0;
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
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const readiness = calculateReadiness(data);
  const factors = useMemo(() => getFactors(data), [data]);
  const unread = data.notifications.filter((n) => !n.read_at);
  const nextTournament = [...data.tournaments]
    .filter((t) => t.starts_at && new Date(t.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];
  const pending = data.checklist.filter((x) => !x.completed).slice(0, 3);

  useEffect(() => {
    if (!supabase || !data.profile.user_id) return;
    const tables = ["profiles", "training", "tournaments", "goals", "checklist", "documents", "student_verifications", "notifications", "weights", "medals"];
    const channel = supabase.channel(`athlete-command-center-${data.profile.user_id}`);
    tables.forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${data.profile.user_id}` }, async () => {
      setUpdatedAt(new Date());
      if (onRefresh) await onRefresh();
    }));
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.profile.user_id, onRefresh]);

  const activities = [
    ...data.training.map((x) => ({ at: x.session_date, label: `Training: ${x.title}`, icon: Activity })),
    ...data.medals.map((x) => ({ at: x.awarded_at, label: `Medal: ${x.event_name}`, icon: Trophy })),
    ...data.documents.map((x) => ({ at: x.issued_at, label: `Document: ${x.title}`, icon: FileText })),
  ].filter((x) => x.at).sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime()).slice(0, 6);

  return <div className="athlete-command-center">
    <section className="grid two">
      <article className="card panel readiness-card">
        <div className="section-heading"><div><span className="eyebrow">Live readiness</span><h3>{readiness}% ready</h3></div><Target /></div>
        <div className="readiness-ring"><strong>{readiness}%</strong><span>overall</span></div>
        <div className="factor-list">{factors.map((factor) => <div className="factor" key={factor.label}><div><span>{factor.label}</span><b>{factor.score}%</b></div><i><em style={{ width: `${factor.score}%` }} /></i></div>)}</div>
        <small>Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
      </article>

      <article className="card panel today-card">
        <div className="section-heading"><div><span className="eyebrow">Today</span><h3>Command center</h3></div><Calendar /></div>
        {nextTournament ? <div className="command-item"><Trophy /><div><strong>Next tournament</strong><span>{nextTournament.name} · {new Date(nextTournament.starts_at!).toLocaleDateString()}</span></div></div> : <div className="empty"><strong>No upcoming tournament</strong><span>Add your next competition to track preparation.</span></div>}
        <div className="command-item"><CheckCircle2 /><div><strong>{pending.length} checklist items pending</strong><span>{pending[0]?.item || "Everything currently marked complete."}</span></div></div>
        <div className="command-item"><Weight /><div><strong>Latest weight</strong><span>{data.weights.at(-1)?.weight_kg ?? data.profile.weight_kg ?? "—"} kg</span></div></div>
        <div className="command-item"><Bell /><div><strong>{unread.length} unread notifications</strong><span>{unread[0]?.title || "You're all caught up."}</span></div></div>
      </article>
    </section>

    <section className="grid two">
      <article className="card panel"><div className="section-heading"><div><span className="eyebrow">Timeline</span><h3>Recent activity</h3></div><Activity /></div>{activities.length ? <div className="timeline">{activities.map((item, index) => { const Icon = item.icon; return <div className="timeline-item" key={`${item.label}-${index}`}><Icon size={16} /><div><strong>{item.label}</strong><span>{new Date(item.at!).toLocaleString()}</span></div></div>; })}</div> : <div className="empty"><strong>No activity yet</strong><span>Log training, medals, weights, or documents to build your timeline.</span></div>}</article>
      <article className="card panel"><div className="section-heading"><div><span className="eyebrow">Next actions</span><h3>Close the gaps</h3></div><CheckCircle2 /></div><ul className="action-list">{factors.filter((x) => x.score < 100).sort((a, b) => a.score - b.score).slice(0, 5).map((factor) => <li key={factor.label}><span>{factor.label} is at {factor.score}%</span><b>+{Math.round((100 - factor.score) * factor.weight / 100)} pts potential</b></li>)}{!factors.some((x) => x.score < 100) && <li><span>All readiness areas are complete.</span><b>100%</b></li>}</ul></article>
    </section>
  </div>;
}

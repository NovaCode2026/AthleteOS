import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type AdminControlCenterProps = { userId: string; role: string };
type Section = { key: string; label: string; table: string; deleteAllowed?: boolean };

const sections: Section[] = [
  ["profiles", "Users / Profiles", "profiles"],
  ["academies", "Academies", "academies"],
  ["academyMemberships", "Academy Memberships", "academy_memberships"],
  ["training", "Training", "training_sessions"],
  ["trainingPlans", "Training Plans", "training_plans"],
  ["attendance", "Attendance", "attendance_records"],
  ["tournaments", "Tournaments", "tournaments"],
  ["matches", "Matches", "matches"],
  ["medals", "Medals", "medals"],
  ["certificates", "Certificates", "certificates"],
  ["documents", "Documents", "documents"],
  ["weights", "Weight Logs", "weight_logs"],
  ["calendar", "Calendar", "calendar_events"],
  ["notifications", "Notifications", "notifications", false],
  ["checklist", "Competition Checklist", "competition_checklists"],
  ["injuries", "Injuries", "injuries"],
  ["goals", "Goals", "goals"],
  ["feedback", "Feedback", "feedback_items"],
  ["verifications", "Student Verification", "student_verifications"],
  ["roadmap", "Roadmap", "roadmap_items"],
  ["roadmapVotes", "Roadmap Votes", "roadmap_votes"],
  ["tournamentScans", "Tournament Scans", "tournament_scans"],
  ["referrals", "Referrals", "referrals"],
  ["badges", "Athlete Badges", "athlete_badges"],
  ["aiUsage", "AI Usage", "ai_usage_events"],
  ["subscriptions", "Subscriptions", "subscriptions"],
  ["subscriptionUsage", "Subscription Usage", "subscription_usage"],
  ["paymentEvents", "Payment Events", "payment_events"],
  ["support", "Support Tickets", "support_tickets", false],
  ["announcements", "Announcements", "announcements"],
  ["featureFlags", "Feature Flags", "feature_flags"],
  ["auditLogs", "Audit Logs", "audit_logs", false],
].map(([key, label, table, deleteAllowed = true]) => ({ key, label, table, deleteAllowed }));

export default function AdminControlCenter({ userId, role }: AdminControlCenterProps) {
  const [selected, setSelected] = useState(sections[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const section = sections.find((item) => item.key === selected) ?? sections[0];
  const isSuperAdmin = role === "super_admin";
  const canManage = role === "admin" || isSuperAdmin;
  const canDelete = canManage && section.deleteAllowed && (isSuperAdmin || !["profiles", "subscriptions", "paymentEvents", "auditLogs"].includes(section.key));

  const load = async () => {
    if (!supabase) { setError("Supabase is not configured."); setRows([]); return; }
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from(section.table).select("*").limit(100);
    if (queryError) setError(queryError.message);
    setRows((data ?? []) as Record<string, unknown>[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!supabase) return;
    const channel = supabase.channel(`admin-${section.table}`).on("postgres_changes", { event: "*", schema: "public", table: section.table }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [section.table]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return Array.from(keys).slice(0, 8);
  }, [rows]);

  const remove = async (id: unknown) => {
    if (!canDelete || !id || !supabase || !window.confirm("Delete this record? This action cannot be undone.")) return;
    const { error: deleteError } = await supabase.from(section.table).delete().eq("id", String(id));
    if (deleteError) setError(deleteError.message); else await load();
  };

  return <section className="admin-control-center card" aria-label="Admin control center">
    <div className="admin-header"><div><span className="eyebrow">Admin control center</span><h2>System controls</h2><p>Role: <strong>{role}</strong> · Realtime refresh is enabled for the selected resource.</p></div><button className="btn" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button></div>
    <div className="admin-grid">
      <nav className="admin-sidebar" aria-label="Admin resources">{sections.map((item) => <button key={item.key} className={item.key === selected ? "active" : ""} onClick={() => setSelected(item.key)}>{item.label}</button>)}</nav>
      <div className="admin-resource"><div className="admin-resource-head"><h3>{section.label}</h3><span>{rows.length} loaded</span></div>
        {error && <p className="notice" role="alert">{error}</p>}
        {!canManage && <p className="notice" role="status">Read-only admin view. Elevated write controls require an admin or super_admin role.</p>}
        {!!rows.length && <div className="table-wrap"><table><thead><tr>{columns.map((key) => <th key={key}>{key}</th>)}{canDelete && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((key) => <td key={key}>{typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "—")}</td>)}{canDelete && <td><button className="btn danger" onClick={() => void remove(row.id)} disabled={!row.id}>Delete</button></td>}</tr>)}</tbody></table></div>}
        {!loading && !rows.length && <div className="empty"><strong>No records found</strong><p>There are no records visible to this admin role.</p></div>}
        <small className="admin-note">Signed-in administrator: {userId}</small>
      </div>
    </div>
  </section>;
}

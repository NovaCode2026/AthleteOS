import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type AdminControlCenterProps = { userId: string; role: string };
type Section = { key: string; label: string; table: string };

const sections: Section[] = [
  { key: "profiles", label: "Users / Profiles", table: "profiles" },
  { key: "academies", label: "Academies", table: "academies" },
  { key: "training", label: "Training", table: "training_sessions" },
  { key: "tournaments", label: "Tournaments", table: "tournaments" },
  { key: "medals", label: "Medals", table: "medals" },
  { key: "documents", label: "Documents", table: "documents" },
  { key: "verification", label: "Verification", table: "student_verifications" },
  { key: "subscriptions", label: "Subscriptions", table: "subscriptions" },
  { key: "ai", label: "AI Usage", table: "ai_usage_events" },
  { key: "flags", label: "Feature Flags", table: "feature_flags" },
  { key: "announcements", label: "Announcements", table: "announcements" },
  { key: "roadmap", label: "Roadmap", table: "roadmap_items" },
  { key: "support", label: "Support", table: "support_tickets" },
  { key: "notifications", label: "Notifications", table: "notifications" },
];

export default function AdminControlCenter({ userId, role }: AdminControlCenterProps) {
  const [selected, setSelected] = useState(sections[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const section = sections.find((item) => item.key === selected) ?? sections[0];
  const canManage = ["admin", "super_admin"].includes(role);

  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.from(section.table).select("*").limit(100);
    if (queryError) setError(queryError.message);
    setRows((data ?? []) as Record<string, unknown>[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`admin-${section.table}`)
      .on("postgres_changes", { event: "*", schema: "public", table: section.table }, load)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [section.table]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return Array.from(keys).slice(0, 8);
  }, [rows]);

  const remove = async (id: unknown) => {
    if (!canManage || !id || !window.confirm("Delete this record? This action cannot be undone.")) return;
    const { error: deleteError } = await supabase.from(section.table).delete().eq("id", String(id));
    if (deleteError) setError(deleteError.message); else await load();
  };

  return (
    <section className="admin-control-center card" aria-label="Admin control center">
      <div className="admin-header">
        <div>
          <span className="eyebrow">Admin control center</span>
          <h2>System controls</h2>
          <p>Authenticated operations only. Realtime data refresh is enabled for the selected resource.</p>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      <div className="admin-grid">
        <nav className="admin-sidebar" aria-label="Admin resources">
          {sections.map((item) => (
            <button key={item.key} className={item.key === selected ? "active" : ""} onClick={() => setSelected(item.key)}>{item.label}</button>
          ))}
        </nav>

        <div className="admin-resource">
          <div className="admin-resource-head">
            <h3>{section.label}</h3>
            <span>{rows.length} loaded</span>
          </div>
          {error && <p className="notice" role="alert">{error}</p>}
          {!loading && !rows.length && <div className="empty"><strong>No records found</strong><p>There are no records visible to this admin role.</p></div>}
          {!!rows.length && <div className="table-wrap"><table><thead><tr>{columns.map((key) => <th key={key}>{key}</th>)}{canManage && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((key) => <td key={key}>{typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "—")}</td>)}{canManage && <td><button className="btn danger" onClick={() => void remove(row.id)} disabled={!row.id}>Delete</button></td>}</tr>)}</tbody></table></div>}
          <small className="admin-note">Signed-in administrator: {userId}</small>
        </div>
      </div>
    </section>
  );
}

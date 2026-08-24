import fs from "node:fs";

const path = "src/App.tsx";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import "./styles/main.css";';
const adminImport = 'import AdminControlCenter from "./components/admin/AdminControlCenter";';
if (!source.includes(adminImport)) {
  if (!source.includes(importAnchor)) throw new Error("App.tsx import anchor not found");
  source = source.replace(importAnchor, `${adminImport}\n${importAnchor}`);
}

const oldRoute = 'else if (page === "admin") content = isAdmin ? <AdminPage data={data} goDashboard={() => navigate("dashboard")} /> :';
const newRoute = 'else if (page === "admin") content = isAdmin ? <AdminPage data={data} goDashboard={() => navigate("dashboard")} userId={auth.user?.id} role={data.profile.role || "user"} /> :';
if (source.includes(oldRoute)) source = source.replace(oldRoute, newRoute);

const oldAdmin = `function AdminPage({ data, goDashboard }: { data: CloudData; goDashboard: () => void }) {
  return <FeaturePage title="Admin command center">
    <section className="metrics">
      <Stat icon={User} label="Users" value="RBAC" note="Admin policies ready" />
      <Stat icon={BadgeCheck} label="Verifications" value={data.verifications.length} note="Pending workflow" />
      <Stat icon={Sparkles} label="AI" value="metered" note="Usage events" />
      <Stat icon={Target} label="Roadmap" value={data.roadmap.length} note="Public items" />
    </section>
    <section className="card panel">
      <h3>Operational controls</h3>
      <p>Admin tables and RLS foundations are ready for review queues, plan management, feedback triage, badge awards, support tickets, announcements, feature flags, audit logs, academy management, and analytics. Promote trusted staff through Supabase SQL or a service-role-only backend process; users cannot grant themselves admin privileges.</p>
      <button className="btn" onClick={goDashboard}>Back to dashboard</button>
    </section>
  </FeaturePage>;
}`;

const newAdmin = `function AdminPage({ data, goDashboard, userId, role }: { data: CloudData; goDashboard: () => void; userId?: string; role: string }) {
  return <AdminControlCenter userId={userId || data.profile.user_id || "unknown"} role={role} />;
}`;

if (source.includes(oldAdmin)) source = source.replace(oldAdmin, newAdmin);
else if (!source.includes("<AdminControlCenter")) throw new Error("Existing AdminPage block not found; refusing unsafe rewrite");

fs.writeFileSync(path, source);
console.log("AdminControlCenter wired into App.tsx safely.");

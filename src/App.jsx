import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, Bell, Calendar, CheckCircle2, Cloud, FileText, FolderLock, LogOut,
  Medal, Plus, Shield, Sparkles, Target, Trophy, User, Weight
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { deleteRow, insertRow, listRows, upsertRow } from "./services/database.js";
import { seed } from "./data/seed.js";
import "./styles/main.css";

const nav = [
  ["dashboard", "Dashboard", Activity],
  ["profile", "Profile", User],
  ["tournaments", "Tournaments", Trophy],
  ["training", "Training", Calendar],
  ["medals", "Medals", Medal],
  ["documents", "Documents", FolderLock],
  ["weight", "Weight", Weight],
  ["calendar", "Calendar", Calendar],
  ["checklist", "Checklist", CheckCircle2],
  ["ai", "AI Coach", Sparkles]
];

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Toast({ toast }) {
  return toast ? <div className={`toast ${toast.type}`}>{toast.message}</div> : null;
}

function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      if (mode === "register") {
        await auth.signUp({ email: form.email, password: form.password, metadata: { full_name: form.name } });
        setMessage("Registration started. Check your email to verify your account.");
      } else if (mode === "forgot") {
        await auth.resetPassword(form.email);
        setMessage("Password reset email sent.");
      } else if (mode === "reset") {
        await auth.updatePassword(form.password);
        setMessage("Password updated. You can continue to AthleteOS.");
      } else {
        await auth.signIn({ email: form.email, password: form.password });
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!auth.configured) {
    return <main className="auth-page"><section className="auth-card">
      <h1>AthleteOS</h1>
      <p>Supabase is not configured. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to run the cloud app.</p>
    </section></main>;
  }

  return <main className="auth-page">
    <section className="auth-card">
      <span className="eyebrow">Nova Code</span>
      <h1>AthleteOS – Taekwondo Edition</h1>
      <p>Secure cloud command center for training, tournaments, documents, medals, goals, and AI coaching.</p>
      <form onSubmit={submit}>
        {mode === "register" && <Field label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />}
        <Field label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        {mode !== "forgot" && <Field label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />}
        <label className="remember"><input type="checkbox" defaultChecked /> Remember me on this device</label>
        <button className="btn primary">{mode === "register" ? "Create account" : mode === "forgot" ? "Send reset email" : mode === "reset" ? "Update password" : "Log in"}</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <div className="auth-links">
        <button onClick={() => setMode("login")}>Login</button>
        <button onClick={() => setMode("register")}>Register</button>
        <button onClick={() => setMode("forgot")}>Forgot password</button>
        <button onClick={() => setMode("reset")}>Reset password</button>
      </div>
    </section>
  </main>;
}

function Stat({ icon: Icon, label, value, note }) {
  return <article className="metric card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function DataTable({ rows, columns, empty }) {
  if (!rows.length) return <div className="empty"><strong>{empty}</strong><p>Add a record with the quick action above.</p></div>;
  return <div className="table-wrap"><table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id || JSON.stringify(row)}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}</tr>)}</tbody></table></div>;
}

function useCloudData(user, setToast) {
  const [data, setData] = useState({ profile: seed.profile, tournaments: [], training: [], medals: [], weights: [], goals: [], checklist: [], documents: [], notifications: [] });
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [profiles, tournaments, training, medals, weights, goals, checklist, documents, notifications] = await Promise.all([
        listRows("profile", user.id),
        listRows("tournaments", user.id, { order: "starts_at", ascending: true }),
        listRows("training", user.id, { order: "session_date", ascending: false }),
        listRows("medals", user.id, { order: "awarded_at", ascending: false }),
        listRows("weights", user.id, { order: "logged_at", ascending: true }),
        listRows("goals", user.id, { order: "target_date", ascending: true }),
        listRows("checklist", user.id),
        listRows("documents", user.id, { order: "created_at" }),
        listRows("notifications", user.id, { order: "created_at" })
      ]);
      setData({
        profile: profiles[0] || { ...seed.profile, user_id: user.id },
        tournaments: tournaments.length ? tournaments : seed.tournaments,
        training: training.length ? training : seed.training,
        medals: medals.length ? medals : seed.medals,
        weights: weights.length ? weights : seed.weights,
        goals: goals.length ? goals : seed.goals,
        checklist: checklist.length ? checklist : seed.checklist,
        documents,
        notifications
      });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [user?.id]);
  return { data, loading, refresh };
}

function Dashboard({ data, openForm }) {
  const latestWeight = data.weights.at(-1)?.weight_kg || data.profile.weight_kg || 0;
  return <>
    <section className="hero card"><div><span className="pill">Taekwondo Edition</span><h2>Train, compete, recover, repeat.</h2><p>Cloud-backed athlete operating system with Supabase security and server-side AI.</p><div className="hero-actions"><button className="btn primary" onClick={() => openForm("training")}>Log training</button><button className="btn" onClick={() => openForm("tournaments")}>Add tournament</button></div></div><div className="readiness"><strong>82%</strong><span>Readiness</span></div></section>
    <section className="metrics">
      <Stat icon={Trophy} label="Upcoming tournaments" value={data.tournaments.length} note="Tracked events" />
      <Stat icon={Calendar} label="Recent training" value={data.training.length} note="Sessions" />
      <Stat icon={Weight} label="Current weight" value={`${latestWeight} kg`} note="Latest log" />
      <Stat icon={Medal} label="Medals" value={data.medals.length} note="Career history" />
    </section>
    <section className="grid two">
      <article className="card panel"><h3>Weight trend</h3><ResponsiveContainer width="100%" height={220}><LineChart data={data.weights}><CartesianGrid strokeDasharray="3 3" stroke="#25405f" /><XAxis dataKey="logged_at" /><YAxis /><Tooltip /><Line type="monotone" dataKey="weight_kg" stroke="#49d7ff" strokeWidth={3} /></LineChart></ResponsiveContainer></article>
      <article className="card panel"><h3>Goals</h3>{data.goals.map(goal => <div className="goal" key={goal.id || goal.title}><span>{goal.title}</span><b>{goal.progress || 0}%</b><i style={{ width: `${goal.progress || 0}%` }} /></div>)}</article>
    </section>
  </>;
}

function FeaturePage({ title, actions, children }) {
  return <><div className="page-head"><div><p className="eyebrow">AthleteOS Cloud</p><h2>{title}</h2></div>{actions}</div>{children}</>;
}

function AiCoach({ setToast }) {
  const [topic, setTopic] = useState("Training Coach");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/.netlify/functions/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, prompt })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI request failed.");
      setAnswer(payload.answer);
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return <FeaturePage title="Secure AI Coach" actions={null}>
    <section className="card panel ai-panel">
      <select value={topic} onChange={e => setTopic(e.target.value)}>
        {["Training Coach", "Tournament Preparation", "Match Analysis", "Nutrition Advice", "Recovery Advice", "Goal Suggestions", "Performance Reports", "Motivational Feedback"].map(item => <option key={item}>{item}</option>)}
      </select>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your goal, recent training, opponent, recovery issue, or tournament situation." />
      <button className="btn primary" onClick={ask} disabled={loading}>{loading ? "Thinking..." : "Ask AI Coach"}</button>
      {answer && <div className="answer">{answer}</div>}
    </section>
  </FeaturePage>;
}

function AppShell() {
  const auth = useAuth();
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const { data, loading, refresh } = useCloudData(auth.user, setToast);
  const [form, setForm] = useState(null);

  const current = useMemo(() => nav.find(([id]) => id === page), [page]);

  async function save(resource, values) {
    try {
      const user_id = auth.user.id;
      if (resource === "profile") await upsertRow("profile", { ...data.profile, ...values, user_id });
      else await insertRow(resource, { ...values, user_id });
      setToast({ type: "success", message: "Saved securely in Supabase." });
      setForm(null);
      refresh();
    } catch (error) {
      setToast({ type: "error", message: error.message });
    }
  }

  async function remove(resource, id) {
    if (!id) return;
    try {
      await deleteRow(resource, id, auth.user.id);
      setToast({ type: "success", message: "Deleted." });
      refresh();
    } catch (error) {
      setToast({ type: "error", message: error.message });
    }
  }

  function openForm(resource) { setForm({ resource, values: {} }); }

  let content = null;
  if (loading) content = <div className="skeleton card">Loading AthleteOS...</div>;
  else if (page === "dashboard") content = <Dashboard data={data} openForm={openForm} />;
  else if (page === "profile") content = <FeaturePage title="Athlete Profile" actions={<button className="btn primary" onClick={() => openForm("profile")}><User size={16} /> Edit profile</button>}><section className="card panel profile-grid"><div className="avatar-lg">{(data.profile.full_name || "A").slice(0, 2)}</div><div><h3>{data.profile.full_name}</h3><p>{data.profile.belt} | {data.profile.academy}</p><p>Coach: {data.profile.coach}</p><p>Emergency: {data.profile.emergency_contact}</p></div></section></FeaturePage>;
  else if (page === "tournaments") content = <FeaturePage title="Tournaments" actions={<button className="btn primary" onClick={() => openForm("tournaments")}><Plus size={16} /> Add</button>}><DataTable rows={data.tournaments} empty="No tournaments yet" columns={[{ key: "name", label: "Tournament" }, { key: "starts_at", label: "Date" }, { key: "location", label: "Location" }, { key: "status", label: "Status" }, { key: "remove", label: "", render: row => <button className="plain" onClick={() => remove("tournaments", row.id)}>Delete</button> }]} /></FeaturePage>;
  else if (page === "training") content = <FeaturePage title="Training Sessions" actions={<button className="btn primary" onClick={() => openForm("training")}><Plus size={16} /> Log</button>}><DataTable rows={data.training} empty="No training sessions yet" columns={[{ key: "title", label: "Session" }, { key: "session_date", label: "Date" }, { key: "minutes", label: "Minutes" }, { key: "intensity", label: "Intensity" }]} /></FeaturePage>;
  else if (page === "medals") content = <FeaturePage title="Medals" actions={<button className="btn primary" onClick={() => openForm("medals")}><Plus size={16} /> Add</button>}><DataTable rows={data.medals} empty="No medals yet" columns={[{ key: "event_name", label: "Event" }, { key: "medal_type", label: "Medal" }, { key: "category", label: "Category" }, { key: "awarded_at", label: "Date" }]} /></FeaturePage>;
  else if (page === "documents") content = <FeaturePage title="Secure Documents" actions={<button className="btn primary" onClick={() => openForm("documents")}><Plus size={16} /> Add</button>}><DataTable rows={data.documents} empty="No documents yet" columns={[{ key: "title", label: "Document" }, { key: "document_type", label: "Type" }, { key: "expires_at", label: "Expiry" }]} /></FeaturePage>;
  else if (page === "weight") content = <FeaturePage title="Weight Tracker" actions={<button className="btn primary" onClick={() => openForm("weights")}><Plus size={16} /> Log</button>}><section className="card panel"><ResponsiveContainer width="100%" height={320}><LineChart data={data.weights}><CartesianGrid strokeDasharray="3 3" stroke="#25405f" /><XAxis dataKey="logged_at" /><YAxis /><Tooltip /><Line type="monotone" dataKey="weight_kg" stroke="#52ddac" strokeWidth={3} /></LineChart></ResponsiveContainer></section></FeaturePage>;
  else if (page === "calendar") content = <FeaturePage title="Calendar" actions={<button className="btn primary" onClick={() => openForm("calendar")}><Plus size={16} /> Add</button>}><DataTable rows={data.training.map(item => ({ ...item, event_type: "training" })).concat(data.tournaments.map(item => ({ title: item.name, session_date: item.starts_at, event_type: "competition" })))} empty="No calendar events" columns={[{ key: "title", label: "Event" }, { key: "session_date", label: "Date" }, { key: "event_type", label: "Type" }]} /></FeaturePage>;
  else if (page === "checklist") content = <FeaturePage title="Competition Checklist" actions={<button className="btn primary" onClick={() => openForm("checklist")}><Plus size={16} /> Add</button>}><section className="card checklist">{data.checklist.map(item => <label key={item.id || item.item}><input type="checkbox" checked={Boolean(item.completed)} readOnly /> {item.item}<span>{item.category}</span></label>)}</section></FeaturePage>;
  else if (page === "ai") content = <AiCoach setToast={setToast} />;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><Shield /> <span>Athlete<span>OS</span></span></div><p className="edition">Taekwondo Edition</p><nav>{nav.map(([id, label, Icon]) => <button key={id} className={id === page ? "active" : ""} onClick={() => setPage(id)}><Icon size={18} /> {label}</button>)}</nav><button className="logout" onClick={auth.signOut}><LogOut size={16} /> Logout</button></aside>
    <main><header><div><p className="eyebrow">Nova Code Cloud</p><h1>{current?.[1] || "Dashboard"}</h1></div><button className="icon-btn"><Bell size={18} /></button></header>{content}<footer>Copyright (c) 2026 Nova Code</footer></main>
    <Toast toast={toast} />
    {form && <RecordModal form={form} setForm={setForm} save={save} profile={data.profile} />}
  </div>;
}

function RecordModal({ form, setForm, save, profile }) {
  const [values, setValues] = useState(form.resource === "profile" ? profile : {});
  const fields = {
    profile: [["full_name", "Name"], ["date_of_birth", "Date of birth", "date"], ["weight_kg", "Weight", "number"], ["height_cm", "Height", "number"], ["belt", "Belt"], ["academy", "Academy"], ["coach", "Coach"], ["emergency_contact", "Emergency contact"]],
    tournaments: [["name", "Tournament"], ["starts_at", "Date", "date"], ["location", "Location"], ["status", "Status"], ["opponent_notes", "Opponent notes"], ["match_notes", "Match notes"]],
    training: [["title", "Session"], ["session_date", "Date", "date"], ["minutes", "Minutes", "number"], ["intensity", "Intensity"]],
    medals: [["event_name", "Event"], ["medal_type", "Medal"], ["category", "Category"], ["awarded_at", "Date", "date"]],
    documents: [["title", "Document"], ["document_type", "Type"], ["expires_at", "Expiry", "date"]],
    weights: [["logged_at", "Date", "date"], ["weight_kg", "Weight", "number"], ["target_weight_kg", "Target", "number"]],
    calendar: [["title", "Event"], ["event_date", "Date", "date"], ["event_type", "Type"], ["reminder_at", "Reminder", "datetime-local"]],
    checklist: [["item", "Item"], ["category", "Category"]]
  }[form.resource] || [];

  return <div className="modal-backdrop"><form className="modal" onSubmit={event => { event.preventDefault(); save(form.resource, values); }}><button type="button" className="close" onClick={() => setForm(null)}>x</button><h2>{form.resource}</h2>{fields.map(([name, label, type = "text"]) => <Field key={name} label={label} type={type} value={values[name] || ""} onChange={event => setValues({ ...values, [name]: event.target.value })} />)}<button className="btn primary">Save</button></form></div>;
}

function ProtectedApp() {
  const auth = useAuth();
  if (auth.loading) return <main className="auth-page"><section className="auth-card">Loading secure session...</section></main>;
  return auth.user ? <AppShell /> : <AuthScreen />;
}

createRoot(document.getElementById("root")).render(<AuthProvider><ProtectedApp /></AuthProvider>);

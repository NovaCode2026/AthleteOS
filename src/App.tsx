import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, BadgeCheck, Bell, Calendar, CheckCircle2, CreditCard, FileText, FolderLock,
  Download, ExternalLink, Gauge, HeartPulse, LogOut, Medal, Plus, RefreshCw, ScanLine, Shield,
  Sparkles, Star, Target, Trash2, Trophy, Upload, User, Weight
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { isSupabaseConfigured, supabaseConfig } from "./lib/supabase";
import {
  createSignedFileUrl, deletePrivateFile, deleteRow, insertRow, listRows, updateRow, uploadPrivateFile, upsertRow, type Resource
} from "./services/database";
import { plans, getPlan } from "./config/plans";
import type {
  ChecklistItem, CloudData, DocumentRecord, FeedbackItem, Goal, Medal as MedalRecord,
  AiUsageEvent, Profile, RoadmapItem, RoadmapVote, Subscription, SubscriptionUsage, TournamentScan, TrainingSession, Tournament, UsageSummary, VerificationRequest, WeightLog
} from "./types";
import "./styles/main.css";

type PageId = "dashboard" | "profile" | "plans" | "verification" | "tournaments" | "training" | "medals" | "documents" | "weight" | "calendar" | "checklist" | "scanner" | "ai" | "feedback" | "roadmap" | "admin";
type ToastState = { type: "success" | "error" | "warning"; message: string } | null;
type AdminRole = "support_admin" | "admin" | "super_admin";
type AuthMode = "login" | "register" | "forgot" | "reset";

const adminRoles = new Set<AdminRole>(["support_admin", "admin", "super_admin"]);

const nav: Array<[PageId, string, typeof Activity]> = [
  ["dashboard", "Dashboard", Activity],
  ["profile", "Profile", User],
  ["plans", "Plans", CreditCard],
  ["verification", "Verification", BadgeCheck],
  ["tournaments", "Tournaments", Trophy],
  ["training", "Training", Calendar],
  ["medals", "Medals", Medal],
  ["documents", "Documents", FolderLock],
  ["weight", "Weight", Weight],
  ["checklist", "Checklist", CheckCircle2],
  ["scanner", "Scanner", ScanLine],
  ["ai", "AI Coach", Sparkles],
  ["feedback", "Feedback", HeartPulse],
  ["roadmap", "Roadmap", Target],
  ["admin", "Admin Panel", Gauge]
];

function isAdminProfile(profile: Profile) {
  return adminRoles.has(profile.role as AdminRole);
}

function isPasswordResetRoute() {
  return window.location.pathname === "/reset-password";
}

function isAuthCallbackRoute() {
  return window.location.pathname === "/auth/callback";
}

function pageFromPath(): PageId {
  return window.location.pathname === "/admin" ? "admin" : "dashboard";
}

function sanitizeProfileValues(values: Partial<Profile>) {
  const safeValues: Partial<Profile> = {};
  const allowedKeys: Array<keyof Profile> = [
    "full_name",
    "date_of_birth",
    "profile_image_path",
    "weight_kg",
    "height_cm",
    "belt",
    "academy",
    "coach",
    "emergency_contact",
    "achievements"
  ];

  for (const key of allowedKeys) {
    if (values[key] !== undefined) {
      safeValues[key] = values[key] as never;
    }
  }

  if (!safeValues.full_name?.trim()) {
    throw new Error("Full name is required to complete onboarding.");
  }

  safeValues.full_name = safeValues.full_name.trim();
  return safeValues;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>;
}

function Toast({ toast }: { toast: ToastState }) {
  return toast ? <div className={`toast ${toast.type}`} role="status">{toast.message}</div> : null;
}

function VerificationCallback() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const errorDescription = params.get("error_description") || params.get("error");

  useEffect(() => {
    if (auth.user) {
      const target = auth.emailVerified ? "/" : "/onboarding";
      window.history.replaceState(null, "", target);
    }
  }, [auth.user, auth.emailVerified]);

  if (errorDescription) {
    return <main className="auth-page"><section className="auth-card">
      <span className="eyebrow">AthleteOS verification</span>
      <h1>Verification link could not be used</h1>
      <p>The link may be expired, already used, or malformed. Return to login and request a new verification email if needed.</p>
      <p className="notice" role="alert">{errorDescription.includes("expired") ? "This verification link has expired." : "Email verification could not be completed."}</p>
    </section></main>;
  }

  return <main className="auth-page"><section className="auth-card">
    <span className="eyebrow">AthleteOS verification</span>
    <h1>{auth.emailVerified ? "Email verified" : "Finishing verification..."}</h1>
    <p>{auth.emailVerified ? "Your email is verified. Redirecting you back to AthleteOS." : "Please wait while AthleteOS confirms your email session."}</p>
  </section></main>;
}

function AuthScreen({ initialMode }: { initialMode?: AuthMode }) {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode || (isPasswordResetRoute() ? "reset" : "login"));
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (mode === "register") {
        await auth.signUp({ email: form.email, password: form.password, metadata: { full_name: form.name } });
        setMessage("Check your email for the AthleteOS verification link. After verifying, you will return here automatically.");
      } else if (mode === "forgot") {
        await auth.resetPassword(form.email);
        setMessage("Password reset email sent.");
      } else if (mode === "reset") {
        await auth.updatePassword(form.password);
        setMessage("Password updated. You can continue to AthleteOS.");
        window.history.replaceState(null, "", "/");
        setMode("login");
      } else {
        await auth.signIn({ email: form.email, password: form.password });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!form.email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      await auth.resendVerification(form.email);
      setMessage("A new AthleteOS verification email has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification email could not be resent.");
    } finally {
      setBusy(false);
    }
  }

  if (!auth.configured) {
    const configurationIssues = supabaseConfig.missing.concat(supabaseConfig.invalid);
    return <main className="auth-page"><section className="auth-card">
      <h1>AthleteOS</h1>
      <p>Supabase is not configured. Add the required public Vite variables to run the cloud app.</p>
      {configurationIssues.length > 0 && <p className="notice" role="status">Missing or invalid: {configurationIssues.join(", ")}</p>}
    </section></main>;
  }

  return <main className="auth-page">
    <section className="auth-card">
      <span className="eyebrow">Nova Code</span>
      <h1>AthleteOS - Taekwondo Edition</h1>
      <p>Secure cloud command center for training, tournaments, documents, medals, goals, verification, plans, and AI coaching.</p>
      <form onSubmit={submit}>
        {mode === "register" && <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
        {mode !== "reset" && <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />}
        {mode !== "forgot" && <Field label="Password" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}
        <label className="remember"><input type="checkbox" defaultChecked /> Remember me on this device</label>
        <button className="btn primary" disabled={busy}>{busy ? "Please wait..." : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset email" : mode === "reset" ? "Update password" : "Log in"}</button>
      </form>
      {message && <p className="notice" role="status">{message}</p>}
      <div className="auth-links">
        <button onClick={() => setMode("login")}>Login</button>
        <button onClick={() => setMode("register")}>Register</button>
        <button onClick={() => setMode("forgot")}>Forgot password</button>
        {mode === "register" && <button onClick={resendVerification} disabled={busy}>Resend verification</button>}
        {mode === "reset" && <button onClick={() => setMode("reset")}>Reset password</button>}
      </div>
    </section>
  </main>;
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string | number; note: string }) {
  return <article className="metric card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function DataTable<T extends { id?: string }>({ rows, columns, empty }: {
  rows: T[];
  empty: string;
  columns: Array<{ key: string; label: string; render?: (row: T) => React.ReactNode }>;
}) {
  if (!rows.length) return <div className="empty"><strong>{empty}</strong><p>Add a record with the action above.</p></div>;
  return <div className="table-wrap"><table><thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? index}>{columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

function useCloudData(userId: string | undefined, setToast: (toast: ToastState) => void) {
  const [data, setData] = useState<CloudData>({
    profile: {},
    tournaments: [],
    training: [],
    medals: [],
    weights: [],
    goals: [],
    checklist: [],
    documents: [],
    notifications: [],
    feedback: [],
    verifications: [],
    roadmap: [],
    roadmapVotes: [],
    tournamentScans: [],
    aiUsage: [],
    subscriptions: [],
    subscriptionUsage: []
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!userId || !isSupabaseConfigured) return;
    setLoading(true);
    const dataErrors: string[] = [];

    async function loadUserRows<T>(resource: Resource, options: { order?: string; ascending?: boolean } = {}) {
      try {
        return await listRows<T>(resource, userId, options);
      } catch (error) {
        dataErrors.push(error instanceof Error ? error.message : `Unable to load ${resource}.`);
        return [] as T[];
      }
    }

    try {
      const profiles = await listRows<Profile>("profile", userId);
      const savedProfile = profiles[0];
      const profileComplete = Boolean(savedProfile?.full_name?.trim());
      const profile = savedProfile || { user_id: userId, plan_id: "free", role: "user" };

      const [tournaments, training, medals, weights, goals, checklist, documents, notifications, feedback, verifications, roadmapRows, roadmapVotes, tournamentScans, aiUsage, subscriptions, subscriptionUsage] = await Promise.all([
        loadUserRows<Tournament>("tournaments", { order: "starts_at", ascending: true }),
        loadUserRows<TrainingSession>("training", { order: "session_date", ascending: false }),
        loadUserRows<MedalRecord>("medals", { order: "awarded_at", ascending: false }),
        loadUserRows<WeightLog>("weights", { order: "logged_at", ascending: true }),
        loadUserRows<Goal>("goals", { order: "target_date", ascending: true }),
        loadUserRows<ChecklistItem>("checklist"),
        loadUserRows<DocumentRecord>("documents", { order: "created_at" }),
        loadUserRows<{ id?: string; title: string; body?: string; read_at?: string }>("notifications", { order: "created_at" }),
        listRows<FeedbackItem>("feedback", userId, { order: "created_at", publicRows: true }).catch((error) => {
          dataErrors.push(error instanceof Error ? error.message : "Unable to load feedback.");
          return [] as FeedbackItem[];
        }),
        loadUserRows<VerificationRequest>("verifications", { order: "created_at" }),
        listRows<RoadmapItem>("roadmap", undefined, { order: "votes", publicRows: true }).catch((error) => {
          dataErrors.push(error instanceof Error ? error.message : "Unable to load roadmap.");
          return [] as RoadmapItem[];
        }),
        loadUserRows<RoadmapVote>("roadmapVotes", { order: "created_at" }),
        loadUserRows<TournamentScan>("tournamentScans", { order: "last_checked_at" }),
        loadUserRows<AiUsageEvent>("aiUsage", { order: "created_at" }),
        loadUserRows<Subscription>("subscriptions", { order: "created_at" }),
        loadUserRows<SubscriptionUsage>("subscriptionUsage", { order: "usage_month" })
      ]);

      setHasProfile(profileComplete);
      setData({
        profile,
        tournaments,
        training,
        medals,
        weights,
        goals,
        checklist,
        documents,
        notifications,
        feedback,
        verifications,
        roadmap: roadmapRows.map((item) => ({
          ...item,
          user_has_voted: roadmapVotes.some((vote) => vote.roadmap_item_id === item.id)
        })),
        roadmapVotes,
        tournamentScans,
        aiUsage,
        subscriptions,
        subscriptionUsage
      });

      if (dataErrors.length > 0) {
        setToast({ type: "warning", message: dataErrors.slice(0, 2).join(" ") });
      }
    } catch (error) {
      setHasProfile(false);
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to load profile." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [userId]);
  return { data, loading, refresh, hasProfile };
}

function FeaturePage({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <><div className="page-head"><div><p className="eyebrow">AthleteOS V2</p><h2>{title}</h2></div>{actions}</div>{children}</>;
}

function documentStatus(expiresAt?: string) {
  if (!expiresAt) return { label: "Valid", tone: "success" };
  const today = new Date();
  const expiry = new Date(`${expiresAt}T00:00:00`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Expired", tone: "error" };
  if (days <= 30) return { label: "Expiring soon", tone: "warning" };
  return { label: "Valid", tone: "success" };
}

function scanIntervalHours(planId?: string) {
  return ({ free: 12, student: 6, pro: 3, champion: 1, academy: 0.5 } as Record<string, number>)[planId || "free"] ?? 12;
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Dashboard({ data, usage, openForm }: { data: CloudData; usage: UsageSummary; openForm: (resource: Resource) => void }) {
  const latestWeight = data.weights.at(-1)?.weight_kg || data.profile.weight_kg || 0;
  return <>
    <section className="hero card">
      <div>
        <span className="pill">Taekwondo Edition V2</span>
        <h2>Train, compete, verify, and grow.</h2>
        <p>Cloud-backed athlete operating system with protected routes, Supabase RLS, plan limits, student verification, and server-side AI.</p>
        <div className="hero-actions"><button className="btn primary" onClick={() => openForm("training")}>Log training</button><button className="btn" onClick={() => openForm("tournaments")}>Add tournament</button></div>
      </div>
      <div className="readiness"><strong>{Math.min(99, 70 + data.goals.length * 3)}%</strong><span>Readiness</span></div>
    </section>
    <section className="metrics">
      <Stat icon={Trophy} label="Tournaments" value={data.tournaments.length} note="Tracked events" />
      <Stat icon={Calendar} label="Training" value={data.training.length} note="Sessions logged" />
      <Stat icon={Weight} label="Weight" value={`${latestWeight} kg`} note="Latest log" />
      <Stat icon={Sparkles} label="AI usage" value={`${usage.used}/${usage.limit}`} note={usage.plan.name} />
    </section>
    <section className="grid two">
      <article className="card panel"><h3>Weight trend</h3><ResponsiveContainer width="100%" height={220}><LineChart data={data.weights}><CartesianGrid strokeDasharray="3 3" stroke="#25405f" /><XAxis dataKey="logged_at" /><YAxis /><Tooltip /><Line type="monotone" dataKey="weight_kg" stroke="#49d7ff" strokeWidth={3} /></LineChart></ResponsiveContainer></article>
      <article className="card panel"><h3>Goals</h3>{data.goals.map((goal) => <div className="goal" key={goal.id || goal.title}><span>{goal.title}</span><b>{goal.progress || 0}%</b><i style={{ width: `${goal.progress || 0}%` }} /></div>)}</article>
    </section>
  </>;
}

function PlansPage({ profile, subscriptions }: { profile: Profile; subscriptions: Subscription[] }) {
  const activeSubscription = subscriptions.find((item) => ["active", "trialing"].includes(item.status));
  const entitlementPlanId = activeSubscription?.plan_id || profile.plan_id || "free";
  const currentPlan = getPlan(entitlementPlanId);
  return <FeaturePage title="Plans and billing">
    <section className="card panel billing-note">
      <CreditCard />
      <div>
        <h3>Current entitlement: {currentPlan.name}</h3>
        <p>Plan access is read from your Supabase profile/subscription records. Online checkout is not active yet, so upgrades must be provisioned by an authorized admin or future server-side billing workflow.</p>
      </div>
    </section>
    <section className="plan-grid">
      {plans.map((plan) => <article className={`card plan-card ${plan.id === currentPlan.id ? "active" : ""}`} key={plan.id}>
        <span className="pill">{plan.audience}</span>
        <h3>{plan.name}</h3>
        <strong>{plan.price}</strong>
        <p>{plan.aiLimit} AI coach messages/month</p>
        <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <button className="btn primary" disabled>{plan.id === currentPlan.id ? "Current plan" : "Upgrade unavailable"}</button>
      </article>)}
    </section>
  </FeaturePage>;
}

function VerificationPage({ rows, openForm }: { rows: VerificationRequest[]; openForm: (resource: Resource) => void }) {
  return <FeaturePage title="Student verification" actions={<button className="btn primary" onClick={() => openForm("verifications")}><Plus size={16} /> Submit proof</button>}>
    <section className="card panel">
      <h3>Accepted proof</h3>
      <p>Upload a school ID, fee receipt, or bonafide certificate. Admins review submissions and approve verified athlete access.</p>
      <DataTable rows={rows} empty="No verification requests submitted" columns={[
        { key: "document_type", label: "Proof type" },
        { key: "status", label: "Status" },
        { key: "reviewer_notes", label: "Reviewer notes" }
      ]} />
    </section>
  </FeaturePage>;
}

function AiCoach({ usage, accessToken, setToast }: { usage: UsageSummary; accessToken?: string; setToast: (toast: ToastState) => void }) {
  const [topic, setTopic] = useState("Training Coach");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const remaining = Math.max(0, usage.limit - usage.used);

  async function ask() {
    if (!prompt.trim()) {
      setToast({ type: "warning", message: "Enter a training question before asking AI Coach." });
      return;
    }
    if (!usage.limit) {
      setToast({ type: "error", message: "AI Coach is not available on the Free plan. Upgrade to an eligible plan to use AI." });
      return;
    }
    if (remaining <= 0) {
      setToast({ type: "error", message: "Monthly AI limit reached for your current plan." });
      return;
    }
    if (!accessToken) {
      setToast({ type: "error", message: "Please sign in again before using AI Coach." });
      return;
    }
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/.netlify/functions/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ topic, prompt })
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "AI request failed.");
      setAnswer(payload.answer ?? "");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "AI request failed." });
    } finally {
      setLoading(false);
    }
  }

  return <FeaturePage title="Secure AI Coach">
    <section className="card panel ai-panel">
      <div className="usage-bar"><span>Monthly AI usage</span><strong>{usage.used}/{usage.limit}</strong><i style={{ width: `${usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0}%` }} /></div>
      {!usage.limit && <p className="notice" role="status">Free plan includes zero AI access. AI requests are also blocked on the server before OpenAI is called.</p>}
      <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="AI coaching topic">
        {["Training Coach", "Tournament Preparation", "Match Analysis", "Nutrition Advice", "Recovery Advice", "Goal Suggestions", "Performance Reports", "Motivational Feedback"].map((item) => <option key={item}>{item}</option>)}
      </select>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your goal, recent training, opponent, recovery issue, or tournament situation." />
      <button className="btn primary" onClick={ask} disabled={loading || remaining <= 0 || !usage.limit}>{loading ? "Thinking..." : "Ask AI Coach"}</button>
      {answer && <div className="answer">{answer}</div>}
    </section>
  </FeaturePage>;
}

function DocumentsPage({ rows, openForm, openDocument, removeDocument }: {
  rows: DocumentRecord[];
  openForm: (resource: Resource) => void;
  openDocument: (document: DocumentRecord) => Promise<void>;
  removeDocument: (document: DocumentRecord) => Promise<void>;
}) {
  return <FeaturePage title="Secure Documents" actions={<button className="btn primary" onClick={() => openForm("documents")}><Upload size={16} /> Add document</button>}>
    <section className="card panel">
      <p>Upload private athlete documents to Supabase Storage. Files are stored under your user folder and protected by Storage RLS.</p>
      <DataTable rows={rows} empty="No documents yet" columns={[
        { key: "title", label: "Document" },
        { key: "document_type", label: "Type" },
        { key: "issued_at", label: "Issued" },
        { key: "expires_at", label: "Expiry" },
        { key: "status", label: "Status", render: (row) => {
          const status = documentStatus(row.expires_at);
          return <span className={`status-chip ${status.tone}`}>{status.label}</span>;
        } },
        { key: "actions", label: "", render: (row) => <div className="inline-actions">
          <button className="plain" onClick={() => void openDocument(row)} disabled={!row.file_path}><Download size={14} /> Open</button>
          <button className="plain danger" onClick={() => void removeDocument(row)}><Trash2 size={14} /> Delete</button>
        </div> }
      ]} />
    </section>
  </FeaturePage>;
}

function RoadmapPage({
  rows,
  vote,
  isAdmin,
  openForm,
  updateStatus,
  removeItem
}: {
  rows: RoadmapItem[];
  vote: (item: RoadmapItem) => Promise<void>;
  isAdmin: boolean;
  openForm: (resource: Resource) => void;
  updateStatus: (item: RoadmapItem, status: string) => Promise<void>;
  removeItem: (item: RoadmapItem) => Promise<void>;
}) {
  return <FeaturePage title="Public roadmap" actions={isAdmin ? <button className="btn primary" onClick={() => openForm("roadmap")}><Plus size={16} /> Add roadmap item</button> : undefined}>
    <section className="card panel">
      <p>Votes are stored in Supabase. Each authenticated user can vote once per feature; totals are maintained by the database. Admin-only controls are protected by RLS.</p>
      <DataTable rows={rows} empty="Roadmap is being prepared" columns={[
        { key: "title", label: "Feature" },
        { key: "status", label: "Status", render: (row) => isAdmin ? <select value={row.status || "planned"} onChange={(event) => void updateStatus(row, event.target.value)} aria-label={`Update ${row.title} status`}>
          {["research", "planned", "in-progress", "released"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select> : row.status },
        { key: "votes", label: "Votes" },
        { key: "vote", label: "", render: (row) => <div className="inline-actions"><button className="btn" disabled={row.user_has_voted} onClick={() => void vote(row)}>{row.user_has_voted ? "Voted" : "Vote"}</button>{isAdmin && <button className="plain danger" onClick={() => void removeItem(row)}>Delete</button>}</div> }
      ]} />
    </section>
  </FeaturePage>;
}

function TournamentScannerPage({ scans, planId, accessToken, refresh, setToast }: {
  scans: TournamentScan[];
  planId?: string;
  accessToken?: string;
  refresh: () => Promise<void>;
  setToast: (toast: ToastState) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const hours = scanIntervalHours(planId);
  const nextScan = scans
    .map((scan) => scan.next_check_at ? new Date(scan.next_check_at) : null)
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b))[0];

  async function checkNow(event: React.FormEvent) {
    event.preventDefault();
    if (!sourceUrl.trim()) {
      setToast({ type: "warning", message: "Enter a tournament source URL first." });
      return;
    }
    if (!accessToken) {
      setToast({ type: "error", message: "Please sign in again before scanning." });
      return;
    }
    setChecking(true);
    try {
      const response = await fetch("/.netlify/functions/tournament-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sourceUrl })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Tournament scan failed.");
      setToast({ type: "success", message: "Tournament source checked without using AI." });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Tournament source could not be checked." });
    } finally {
      setChecking(false);
    }
  }

  return <FeaturePage title="Tournament Scanner">
    <section className="card scan">
      <span className="scanner"><ScanLine className="icon" /></span>
      <div>
        <h3>Non-AI tournament monitoring</h3>
        <p>Manual Check Now uses the browser/app connection and a secure server function. It does not consume AI usage. Automatic checks require a scheduled backend worker; a browser/PWA cannot reliably run jobs while closed.</p>
        <p>Current plan interval: every {hours === 0.5 ? "30 minutes" : `${hours} hours`}. Next automatic check: {nextScan ? nextScan.toLocaleString() : "after your first scan"}.</p>
        <form className="inline-form" onSubmit={checkNow}>
          <input type="url" placeholder="https://example.com/tournament-notice" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} required />
          <button className="btn primary" disabled={checking}><RefreshCw size={16} /> {checking ? "Checking..." : "Check Now"}</button>
        </form>
      </div>
    </section>
    <DataTable rows={scans} empty="No tournament sources scanned yet" columns={[
      { key: "source_url", label: "Source", render: (row) => <a href={row.source_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {safeHost(row.source_url)}</a> },
      { key: "tournament_name", label: "Tournament" },
      { key: "tournament_date", label: "Date" },
      { key: "venue", label: "Venue" },
      { key: "last_checked_at", label: "Last checked" },
      { key: "detected_changes", label: "Changes" },
      { key: "status", label: "Status" }
    ]} />
  </FeaturePage>;
}

function AdminPage({ data, goDashboard }: { data: CloudData; goDashboard: () => void }) {
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
}

function OnboardingPage({ profile, saveProfile }: { profile: Profile; saveProfile: (values: Partial<Profile>) => Promise<void> }) {
  const [values, setValues] = useState<Partial<Profile>>({
    full_name: profile.full_name || "",
    belt: profile.belt || "",
    academy: profile.academy || "",
    coach: profile.coach || "",
    emergency_contact: profile.emergency_contact || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await saveProfile(values);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="onboarding-page">
    <section className="auth-card">
      <span className="eyebrow">First setup</span>
      <h1>Complete your AthleteOS profile</h1>
      <p>Add your real athlete details to continue to the dashboard. Demo athlete data is never inserted for authenticated users.</p>
      <form onSubmit={submit}>
        <Field label="Full name" value={values.full_name || ""} onChange={(event) => setValues({ ...values, full_name: event.target.value })} required />
        <Field label="Belt" value={values.belt || ""} onChange={(event) => setValues({ ...values, belt: event.target.value })} />
        <Field label="Academy" value={values.academy || ""} onChange={(event) => setValues({ ...values, academy: event.target.value })} />
        <Field label="Coach" value={values.coach || ""} onChange={(event) => setValues({ ...values, coach: event.target.value })} />
        <Field label="Emergency contact" value={values.emergency_contact || ""} onChange={(event) => setValues({ ...values, emergency_contact: event.target.value })} />
        <button className="btn primary" disabled={saving}>{saving ? "Saving..." : "Save profile and continue"}</button>
      </form>
      {error && <p className="notice" role="alert">{error}</p>}
    </section>
  </main>;
}

function AppShell() {
  const auth = useAuth();
  const [page, setPage] = useState<PageId>(() => pageFromPath());
  const [toast, setToast] = useState<ToastState>(null);
  const { data, loading, refresh, hasProfile } = useCloudData(auth.user?.id, setToast);
  const [form, setForm] = useState<{ resource: Resource; values: Record<string, string | number | boolean> } | null>(null);
  const isAdmin = isAdminProfile(data.profile);
  const visibleNav = useMemo(() => nav.filter(([id]) => id !== "admin" || isAdmin), [isAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!hasProfile && window.location.pathname !== "/onboarding") {
      window.history.replaceState(null, "", "/onboarding");
    } else if (hasProfile && window.location.pathname === "/onboarding") {
      window.history.replaceState(null, "", "/");
    }
  }, [loading, hasProfile]);

  useEffect(() => {
    const syncPath = () => setPage(pageFromPath());
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const current = useMemo(() => visibleNav.find(([id]) => id === page), [page, visibleNav]);
  const pageTitle = current?.[1] || (page === "admin" ? "Admin Panel" : "Dashboard");
  const activeSubscription = data.subscriptions.find((item) => ["active", "trialing"].includes(item.status));
  const plan = getPlan(activeSubscription?.plan_id || data.profile.plan_id);
  const usage: UsageSummary = { used: data.aiUsage.length, limit: plan.aiLimit, plan };

  async function save(resource: Resource, values: Record<string, string | number | boolean>, options: { rethrow?: boolean } = {}) {
    try {
      const user_id = auth.user?.id;
      if (!user_id && resource !== "roadmap") throw new Error("You must be logged in.");
      if (resource === "training" && (!values.title || !values.session_date || !values.minutes)) {
        throw new Error("Training title, date, and minutes are required.");
      }
      if (resource === "tournaments" && !values.name) throw new Error("Tournament name is required.");
      if (resource === "medals" && (!values.event_name || !values.medal_type)) throw new Error("Event and medal type are required.");
      if (resource === "weights" && (!values.logged_at || !values.weight_kg)) throw new Error("Weight date and value are required.");
      if (resource === "documents" && (!values.title || !values.document_type)) throw new Error("Document name and type are required.");
      if (resource === "feedback" && !values.title) throw new Error("Feedback title is required.");
      if (resource === "roadmap" && (!isAdmin || !values.title)) throw new Error(isAdmin ? "Roadmap title is required." : "Admin access required.");
      if (resource === "profile") {
        const safeValues = sanitizeProfileValues(values as Partial<Profile>);
        await upsertRow("profile", { ...safeValues, user_id }, { onConflict: "user_id" });
      }
      else if (resource === "roadmap") await insertRow(resource, values);
      else await insertRow(resource, resource === "feedback" ? { ...values, visibility: values.visibility || "public", user_id } : { ...values, user_id });
      setToast({ type: "success", message: "Saved securely in Supabase." });
      setForm(null);
      try {
        await refresh();
      } catch {
        setToast({ type: "warning", message: "Saved profile, but some dashboard data could not be refreshed." });
      }
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Save failed." });
      if (options.rethrow) throw error;
    }
  }

  async function openDocument(document: DocumentRecord) {
    if (!document.file_path) {
      setToast({ type: "warning", message: "This document has metadata but no uploaded file yet." });
      return;
    }
    try {
      const signedUrl = await createSignedFileUrl("documents", document.file_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to open document." });
    }
  }

  async function removeDocument(document: DocumentRecord) {
    try {
      if (document.file_path) await deletePrivateFile("documents", document.file_path);
      await remove("documents", document.id);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to delete document." });
    }
  }

  async function voteRoadmap(item: RoadmapItem) {
    if (!item.id || !auth.user?.id) {
      setToast({ type: "error", message: "Please sign in before voting." });
      return;
    }
    try {
      await insertRow("roadmapVotes", { roadmap_item_id: item.id, user_id: auth.user.id });
      setToast({ type: "success", message: "Vote recorded." });
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setToast({ type: "warning", message: message.toLowerCase().includes("duplicate") ? "You have already voted for this feature." : "Vote could not be recorded." });
    }
  }

  async function saveProfile(values: Partial<Profile>) {
    await save("profile", values as Record<string, string | number | boolean>, { rethrow: true });
  }

  async function remove(resource: Resource, id?: string) {
    if (!id) return;
    try {
      await deleteRow(resource, id, auth.user?.id);
      setToast({ type: "success", message: "Deleted." });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Delete failed." });
    }
  }

  function navigate(id: PageId) {
    setPage(id);
    window.history.pushState(null, "", id === "admin" ? "/admin" : "/");
  }

  async function updateRoadmapStatus(item: RoadmapItem, status: string) {
    if (!item.id || !isAdmin) return;
    try {
      await updateRow("roadmap", item.id, { status });
      setToast({ type: "success", message: "Roadmap status updated." });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Roadmap status could not be updated." });
    }
  }

  async function removeRoadmapItem(item: RoadmapItem) {
    if (!item.id || !isAdmin) return;
    try {
      await deleteRow("roadmap", item.id);
      setToast({ type: "success", message: "Roadmap item deleted." });
      await refresh();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Roadmap item could not be deleted." });
    }
  }

  function openForm(resource: Resource) { setForm({ resource, values: {} }); }

  let content: React.ReactNode = null;
  if (loading) content = <div className="skeleton card">Loading AthleteOS V2...</div>;
  else if (!hasProfile) return <OnboardingPage profile={data.profile} saveProfile={saveProfile} />;
  else if (page === "dashboard") content = <Dashboard data={data} usage={usage} openForm={openForm} />;
  else if (page === "profile") content = <FeaturePage title="Athlete Profile" actions={<button className="btn primary" onClick={() => openForm("profile")}><User size={16} /> Edit profile</button>}><section className="card panel profile-grid"><div className="avatar-lg">{(data.profile.full_name || "A").slice(0, 2)}</div><div><h3>{data.profile.full_name}</h3><p>{data.profile.belt} | {data.profile.academy}</p><p>Coach: {data.profile.coach}</p><p>Emergency: {data.profile.emergency_contact}</p><div className="badge-row">{data.profile.verified_athlete && <span className="verified"><BadgeCheck size={14} /> Verified Athlete</span>}{data.profile.founder_badge && <span className="verified"><Star size={14} /> Founder</span>}</div></div></section></FeaturePage>;
  else if (page === "plans") content = <PlansPage profile={data.profile} subscriptions={data.subscriptions} />;
  else if (page === "verification") content = <VerificationPage rows={data.verifications} openForm={openForm} />;
  else if (page === "tournaments") content = <FeaturePage title="Tournaments" actions={<button className="btn primary" onClick={() => openForm("tournaments")}><Plus size={16} /> Add</button>}><DataTable rows={data.tournaments} empty="No tournaments yet" columns={[{ key: "name", label: "Tournament" }, { key: "starts_at", label: "Date" }, { key: "location", label: "Location" }, { key: "status", label: "Status" }, { key: "remove", label: "", render: (row) => <button className="plain danger" onClick={() => remove("tournaments", row.id)}>Delete</button> }]} /></FeaturePage>;
  else if (page === "training") content = <FeaturePage title="Training Sessions" actions={<button className="btn primary" onClick={() => openForm("training")}><Plus size={16} /> Log</button>}><DataTable rows={data.training} empty="No training sessions yet" columns={[{ key: "title", label: "Session" }, { key: "session_date", label: "Date" }, { key: "minutes", label: "Minutes" }, { key: "intensity", label: "Intensity" }]} /></FeaturePage>;
  else if (page === "medals") content = <FeaturePage title="Medals" actions={<button className="btn primary" onClick={() => openForm("medals")}><Plus size={16} /> Add</button>}><DataTable rows={data.medals} empty="No medals yet" columns={[{ key: "event_name", label: "Event" }, { key: "medal_type", label: "Medal" }, { key: "category", label: "Category" }, { key: "awarded_at", label: "Date" }]} /></FeaturePage>;
  else if (page === "documents") content = <DocumentsPage rows={data.documents} openForm={openForm} openDocument={openDocument} removeDocument={removeDocument} />;
  else if (page === "weight") content = <FeaturePage title="Weight Tracker" actions={<button className="btn primary" onClick={() => openForm("weights")}><Plus size={16} /> Log</button>}><section className="card panel"><ResponsiveContainer width="100%" height={320}><LineChart data={data.weights}><CartesianGrid strokeDasharray="3 3" stroke="#25405f" /><XAxis dataKey="logged_at" /><YAxis /><Tooltip /><Line type="monotone" dataKey="weight_kg" stroke="#52ddac" strokeWidth={3} /></LineChart></ResponsiveContainer></section></FeaturePage>;
  else if (page === "calendar") content = <FeaturePage title="Calendar"><DataTable rows={data.training.map((item) => ({ ...item, event_type: "training" })).concat(data.tournaments.map((item) => ({ id: item.id, title: item.name, session_date: item.starts_at || "", event_type: "competition", minutes: 0 })))} empty="No calendar events" columns={[{ key: "title", label: "Event" }, { key: "session_date", label: "Date" }, { key: "event_type", label: "Type" }]} /></FeaturePage>;
  else if (page === "checklist") content = <FeaturePage title="Competition Checklist" actions={<button className="btn primary" onClick={() => openForm("checklist")}><Plus size={16} /> Add</button>}><section className="card checklist">{data.checklist.map((item) => <label key={item.id || item.item}><input type="checkbox" checked={Boolean(item.completed)} readOnly /> {item.item}<span>{item.category}</span></label>)}</section></FeaturePage>;
  else if (page === "scanner") content = <TournamentScannerPage scans={data.tournamentScans} planId={plan.id} accessToken={auth.session?.access_token} refresh={refresh} setToast={setToast} />;
  else if (page === "ai") content = <AiCoach usage={usage} accessToken={auth.session?.access_token} setToast={setToast} />;
  else if (page === "feedback") content = <FeaturePage title="Feedback portal" actions={<button className="btn primary" onClick={() => openForm("feedback")}><Plus size={16} /> Submit feedback</button>}><DataTable rows={data.feedback} empty="No feedback yet" columns={[{ key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "priority", label: "Priority" }]} /></FeaturePage>;
  else if (page === "roadmap") content = <RoadmapPage rows={data.roadmap} vote={voteRoadmap} isAdmin={isAdmin} openForm={openForm} updateStatus={updateRoadmapStatus} removeItem={removeRoadmapItem} />;
  else if (page === "admin") content = isAdmin ? <AdminPage data={data} goDashboard={() => navigate("dashboard")} /> : <FeaturePage title="Access denied"><section className="card panel"><h3>Admin access required</h3><p>Your account is not authorized to view admin operations.</p><button className="btn" onClick={() => navigate("dashboard")}>Back to dashboard</button></section></FeaturePage>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><Shield /> <span>Athlete<span>OS</span></span></div><p className="edition">Taekwondo Edition V2</p><nav>{visibleNav.map(([id, label, Icon]) => <button key={id} className={id === page ? "active" : ""} onClick={() => navigate(id)}><Icon size={18} /> {label}</button>)}</nav><button className="logout" onClick={auth.signOut}><LogOut size={16} /> Logout</button></aside>
    <main><header><div><p className="eyebrow">Nova Code Cloud</p><h1>{pageTitle}</h1></div><button className="icon-btn" aria-label="Notifications"><Bell size={18} /></button></header>{!auth.emailVerified && <div className="card panel verify-banner"><BadgeCheck /><span>Please verify your email to unlock full account trust features.</span></div>}{content}<footer>Copyright © 2026 Nova Code</footer></main>
    <Toast toast={toast} />
    {form && <RecordModal form={form} setForm={setForm} save={save} profile={data.profile} userId={auth.user?.id} />}
  </div>;
}

function RecordModal({ form, setForm, save, profile, userId }) {
  form: { resource: Resource };
  setForm: (form: null) => void;
  save: (resource: Resource, values: Record<string, string | number | boolean>) => Promise<void>;
  profile: Profile;
  userId?: string;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(form.resource === "profile" ? profile as Record<string, string | number | boolean> : {});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fields: Array<[string, string, string?, string[]?]> = ({
    profile: [["full_name", "Name"], ["date_of_birth", "Date of birth", "date"], ["weight_kg", "Weight", "number"], ["height_cm", "Height", "number"], ["belt", "Belt"], ["academy", "Academy"], ["coach", "Coach"], ["emergency_contact", "Emergency contact"]],
    tournaments: [["name", "Tournament"], ["starts_at", "Date", "date"], ["location", "Location"], ["status", "Status"], ["opponent_notes", "Opponent notes"], ["match_notes", "Match notes"]],
    training: [["title", "Session"], ["session_date", "Date", "date"], ["minutes", "Minutes", "number"], ["intensity", "Intensity"]],
    medals: [["event_name", "Event"], ["medal_type", "Medal"], ["category", "Category"], ["awarded_at", "Date", "date"]],
    documents: [["title", "Document name"], ["document_type", "Type"], ["issued_at", "Issue date", "date"], ["expires_at", "Expiry date", "date"], ["notes", "Notes"]],
    weights: [["logged_at", "Date", "date"], ["weight_kg", "Weight", "number"], ["target_weight_kg", "Target", "number"]],
    calendar: [["title", "Event"], ["event_date", "Date", "date"], ["event_type", "Type"], ["reminder_at", "Reminder", "datetime-local"]],
    checklist: [["item", "Item"], ["category", "Category"]],
    feedback: [["title", "Title"], ["details", "Details"], ["priority", "Priority", "select", ["low", "normal", "high"]], ["visibility", "Visibility", "select", ["public", "private"]]],
    roadmap: [["title", "Feature"], ["description", "Description"], ["status", "Status", "select", ["research", "planned", "in-progress", "released"]]],
    verifications: [["document_type", "Proof type", "select", ["school_id", "fee_receipt", "bonafide"]], ["file_path", "Storage file path"], ["status", "Status", "select", ["pending", "approved", "rejected"]]]
  } as Partial<Record<Resource, Array<[string, string, string?, string[]?]>>>)[form.resource] || [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...values };
      if (form.resource === "documents" && file) {
        if (!userId) throw new Error("Please sign in again before uploading.");
        const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const safeName = `${crypto.randomUUID()}.${extension}`;
        payload.file_path = await uploadPrivateFile("documents", `${userId}/${safeName}`, file);
      }
      await save(form.resource, payload);
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop"><form className="modal" onSubmit={(event) => { void submit(event); }}><button type="button" className="close" onClick={() => setForm(null)} aria-label="Close">x</button><h2>{form.resource}</h2>{fields.map(([name, label, type = "text", options]) => options ? <SelectField key={name} label={label} value={String(values[name] || "")} onChange={(event) => setValues({ ...values, [name]: event.target.value })}><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField> : <Field key={name} label={label} type={type} value={String(values[name] || "")} onChange={(event) => setValues({ ...values, [name]: type === "number" ? Number(event.target.value) : event.target.value })} />)}{form.resource === "documents" && <label className="field"><span>Upload file</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>}<button className="btn primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button></form></div>;
}

function ProtectedApp() {
  const auth = useAuth();
  if (auth.loading) return <main className="auth-page"><section className="auth-card">Loading secure session...</section></main>;
  if (isAuthCallbackRoute()) return <VerificationCallback />;
  if (isPasswordResetRoute()) return <AuthScreen initialMode="reset" />;
  return auth.user ? <AppShell /> : <AuthScreen />;
}

createRoot(document.getElementById("root") as HTMLElement).render(<AuthProvider><ProtectedApp /></AuthProvider>);

import fs from "node:fs";

const appPath = "src/App.tsx";
const cssPath = "src/styles/main.css";
let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

function addImport(source, importLine, anchor) {
  if (source.includes(importLine)) return source;
  if (!source.includes(anchor)) throw new Error(`Import anchor not found: ${anchor}`);
  return source.replace(anchor, `${importLine}\n${anchor}`);
}

app = addImport(app, 'import AthleteCommandCenter from "./components/dashboard/AthleteCommandCenter";', 'import "./styles/main.css";');
app = addImport(app, 'import AdminControlCenter from "./components/admin/AdminControlCenter";', 'import "./styles/main.css";');
app = addImport(app, 'import MessagingPage from "./components/messaging/MessagingPage";', 'import "./styles/main.css";');

if (!app.includes("<AthleteCommandCenter")) {
  const dashboardStart = app.indexOf("function Dashboard(");
  if (dashboardStart < 0) throw new Error("Dashboard component not found; refusing unsafe rewrite");
  const returnStart = app.indexOf("return <>", dashboardStart);
  if (returnStart < 0) throw new Error("Dashboard return anchor not found; refusing unsafe rewrite");
  const insertion = `return <>\n    <AthleteCommandCenter data={data} />`;
  app = app.slice(0, returnStart) + insertion + app.slice(returnStart + "return <>".length);
}

if (!app.includes("<AdminControlCenter")) {
  const start = app.indexOf("function AdminPage(");
  const end = app.indexOf("function OnboardingPage(", start);
  if (start < 0 || end < 0) throw new Error("AdminPage boundaries not found; refusing unsafe rewrite");
  const admin = `function AdminPage({ data }: { data: CloudData }) {\n  return <AdminControlCenter userId={data.profile.user_id || "unknown"} role={data.profile.role || "athlete"} />;\n}\n\n`;
  app = app.slice(0, start) + admin + app.slice(end);
}

const pageType = 'type PageId = "dashboard" | "profile" | "plans" | "verification" | "tournaments" | "training" | "medals" | "documents" | "weight" | "calendar" | "checklist" | "scanner" | "ai" | "feedback" | "roadmap" | "admin";';
const pageTypeWithMessages = pageType.replace(' | "admin";', ' | "messages" | "admin";');
if (app.includes(pageType) && !app.includes(' | "messages" |')) app = app.replace(pageType, pageTypeWithMessages);

const navAnchor = '  ["dashboard", "Dashboard", Activity],';
if (app.includes(navAnchor) && !app.includes('["messages", "Messages"')) {
  app = app.replace(navAnchor, `${navAnchor}\n  ["messages", "Messages", MessageCircle],`);
}

if (!app.includes("<MessagingPage")) {
  const routeAnchor = '  else if (page === "scanner") content = <TournamentScannerPage scans={data.tournamentScans} planId={plan.id} accessToken={auth.session?.access_token} refresh={refresh} setToast={setToast} />;';
  if (!app.includes(routeAnchor)) throw new Error("Scanner route anchor not found; refusing unsafe rewrite");
  const messagingRoute = `${routeAnchor}\n  else if (page === "messages") content = <MessagingPage userId={auth.user?.id} role={data.profile.role} setToast={setToast} />;`;
  app = app.replace(routeAnchor, messagingRoute);
}

const iconAnchor = '  Activity, BadgeCheck, Bell, Calendar, CheckCircle2, CreditCard, FileText, FolderLock,';
if (app.includes(iconAnchor) && !app.includes('MessageCircle')) {
  app = app.replace(iconAnchor, '  Activity, BadgeCheck, Bell, Calendar, CheckCircle2, CreditCard, FileText, FolderLock,\n  MessageCircle,');
}

const cssMarker = "/* ATHLETEOS_LIVE_COMMAND_CENTER */";
if (!css.includes(cssMarker)) {
  css += `\n${cssMarker}\n.athlete-command-center{display:grid;gap:18px}.athlete-command-center .section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.readiness-card h3,.today-card h3{margin:.2rem 0 0}.readiness-ring{display:flex;align-items:baseline;gap:8px;margin:14px 0}.readiness-ring strong{font-size:3rem;line-height:1}.readiness-ring span,.factor small,.command-item span,.timeline-item span{color:var(--muted,#8fa7bf);font-size:.82rem}.factor{margin:10px 0}.factor>div{display:flex;justify-content:space-between;font-size:.88rem}.factor i{display:block;height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:5px}.factor em{display:block;height:100%;background:linear-gradient(90deg,#49d7ff,#7c5cff);border-radius:inherit}.command-item{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}.command-item:last-child{border-bottom:0}.command-item svg{flex:none;color:#49d7ff}.command-item div{display:grid;gap:3px}.timeline{display:grid;gap:2px}.timeline-item{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}.timeline-item div{display:grid;gap:3px}.action-list{list-style:none;padding:0;margin:0;display:grid;gap:10px}.action-list li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}.admin-control-center{display:grid;gap:18px}.admin-header,.admin-resource-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.admin-grid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px}.admin-sidebar{display:grid;align-content:start;gap:6px}.admin-sidebar button{border:0;background:transparent;color:inherit;text-align:left;padding:9px 10px;border-radius:9px;cursor:pointer}.admin-sidebar button.active{background:rgba(73,215,255,.12);color:#49d7ff}.admin-resource{min-width:0}.admin-note{display:block;margin-top:12px;color:var(--muted,#8fa7bf)}@media(max-width:800px){.admin-grid{grid-template-columns:1fr}.admin-sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-sidebar button{font-size:.85rem}}\n`;
}

const messagingCssMarker = "/* ATHLETEOS_SECURE_MESSAGING */";
if (!css.includes(messagingCssMarker)) {
  css += `\n${messagingCssMarker}\n.messaging-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;min-width:0}.messaging-sidebar,.messaging-chat{min-width:0}.messaging-sidebar{display:grid;gap:14px;align-content:start}.conversation-list{display:grid;gap:6px;max-height:420px;overflow:auto}.conversation-item{appearance:none;border:1px solid transparent;background:transparent;color:inherit;text-align:left;padding:10px;border-radius:10px;cursor:pointer;display:grid;gap:3px}.conversation-item:hover,.conversation-item.active{background:rgba(73,215,255,.09);border-color:rgba(73,215,255,.2)}.conversation-item small,.empty-copy,.message-bubble small,.message-bubble>span{color:var(--muted,#8fa7bf);font-size:.78rem}.messaging-create{display:grid;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}.messaging-create input,.message-compose input,.message-compose select,.messaging-header input{min-width:0}.messaging-header{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:12px}.messaging-header .inline-form{margin:0}.message-list{display:flex;flex-direction:column;gap:9px;min-height:360px;max-height:52vh;overflow:auto;padding:14px 2px}.message-bubble{max-width:78%;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);align-self:flex-start}.message-bubble.mine{align-self:flex-end;background:rgba(73,215,255,.12)}.message-bubble p{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.message-compose{display:grid;grid-template-columns:180px minmax(0,1fr) auto;gap:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.message-compose input,.message-compose select{height:42px}@media(max-width:850px){.messaging-layout{grid-template-columns:1fr}.messaging-header{align-items:flex-start;flex-direction:column}.messaging-header .inline-form{width:100%}.message-compose{grid-template-columns:1fr}.message-bubble{max-width:92%}}\n`;
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
console.log("AthleteOS app features wired successfully.");

import fs from "node:fs";

const appPath = "src/App.tsx";
const cssPath = "src/styles/main.css";
let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const style = '  Activity, BadgeCheck, Bell, Calendar, CheckCircle2, CreditCard, FileText, FolderLock,';
if (!app.includes('import MessagingPage from "./components/messaging/MessagingPage";')) app = app.replace('import "./styles/main.css";', 'import MessagingPage from "./components/messaging/MessagingPage";\nimport "./styles/main.css";');
if (app.includes(style) && !app.includes('  MessageCircle,')) app = app.replace(style, `${style}\n  MessageCircle,`);
const pageType = 'type PageId = "dashboard" | "profile" | "plans" | "verification" | "tournaments" | "training" | "medals" | "documents" | "weight" | "calendar" | "checklist" | "scanner" | "ai" | "feedback" | "roadmap" | "admin";';
if (app.includes(pageType) && !app.includes(' | "messages" |')) app = app.replace(pageType, pageType.replace(' | "admin";', ' | "messages" | "admin";'));
const navAnchor = '  ["dashboard", "Dashboard", Activity],';
if (app.includes(navAnchor) && !app.includes('["messages", "Messages"')) app = app.replace(navAnchor, `${navAnchor}\n  ["messages", "Messages", MessageCircle],`);
const routeAnchor = '  else if (page === "scanner") content = <TournamentScannerPage scans={data.tournamentScans} planId={plan.id} accessToken={auth.session?.access_token} refresh={refresh} setToast={setToast} />;';
if (!app.includes('<MessagingPage') && app.includes(routeAnchor)) app = app.replace(routeAnchor, `${routeAnchor}\n  else if (page === "messages") content = <MessagingPage userId={auth.user?.id} role={data.profile.role} setToast={setToast} />;`);
const marker = '/* ATHLETEOS_SECURE_MESSAGING */';
if (!css.includes(marker)) css += `\n${marker}\n.messaging-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;min-width:0}.messaging-sidebar,.messaging-chat{min-width:0}.messaging-sidebar{display:grid;gap:14px;align-content:start}.conversation-list{display:grid;gap:6px;max-height:420px;overflow:auto}.conversation-item{appearance:none;border:1px solid transparent;background:transparent;color:inherit;text-align:left;padding:10px;border-radius:10px;cursor:pointer;display:grid;gap:3px}.conversation-item:hover,.conversation-item.active{background:rgba(73,215,255,.09);border-color:rgba(73,215,255,.2)}.conversation-item small,.empty-copy,.message-bubble small,.message-bubble>span{color:var(--muted,#8fa7bf);font-size:.78rem}.messaging-create{display:grid;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}.messaging-create input,.message-compose input,.message-compose select,.messaging-header input{min-width:0}.messaging-header{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:12px}.messaging-header .inline-form{margin:0}.message-list{display:flex;flex-direction:column;gap:9px;min-height:360px;max-height:52vh;overflow:auto;padding:14px 2px}.message-bubble{max-width:78%;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);align-self:flex-start}.message-bubble.mine{align-self:flex-end;background:rgba(73,215,255,.12)}.message-bubble p{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.message-compose{display:grid;grid-template-columns:180px minmax(0,1fr) auto;gap:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.message-compose input,.message-compose select{height:42px}@media(max-width:850px){.messaging-layout{grid-template-columns:1fr}.messaging-header{align-items:flex-start;flex-direction:column}.messaging-header .inline-form{width:100%}.message-compose{grid-template-columns:1fr}.message-bubble{max-width:92%}}\n`;
fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);

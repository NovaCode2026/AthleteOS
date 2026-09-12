import fs from "node:fs";

const path = "src/App.tsx";
let source = fs.readFileSync(path, "utf8");

if (!source.includes('import InstagramOrganizerScanner from "./components/instagram/InstagramOrganizerScanner";')) {
  const anchor = 'import MessagingPage from "./components/messaging/MessagingPage";';
  if (!source.includes(anchor)) throw new Error("MessagingPage import anchor not found");
  source = source.replace(anchor, `${anchor}\nimport InstagramOrganizerScanner from "./components/instagram/InstagramOrganizerScanner";`);
}

const oldLine = 'else if (page === "scanner") content = <TournamentScannerPage scans={data.tournamentScans} planId={plan.id} accessToken={auth.session?.access_token} refresh={refresh} setToast={setToast} />;';
const newLine = 'else if (page === "scanner") content = <><TournamentScannerPage scans={data.tournamentScans} planId={plan.id} accessToken={auth.session?.access_token} refresh={refresh} setToast={setToast} /><InstagramOrganizerScanner accessToken={auth.session?.access_token} setToast={setToast} /></>';
if (!source.includes(oldLine) && !source.includes(newLine)) throw new Error("Scanner page anchor not found");
source = source.replace(oldLine, newLine);

fs.writeFileSync(path, source);

import { APP_VERSION, ORGANIZATION, defaultState, navigation } from "./data/defaultState.js";
import { icon } from "./assets/icons.js";
import { api, imageToDataUrl } from "./utils/api.js";
import { $, daysUntil, escapeHtml as esc, formatDate, initials } from "./utils/dom.js";
import { clone, readStore, writeStore } from "./utils/storage.js";

const state = Object.fromEntries(
  Object.entries(defaultState).map(([key, value]) => [key, readStore(key, clone(value))])
);

state.page = "dashboard";
state.month = new Date().getMonth();
state.year = new Date().getFullYear();
state.loading = "";
state.weather = null;

const titles = {
  dashboard: ["Command Center", () => `Good evening, ${state.profile.name.split(" ")[0] || "Athlete"}.`],
  events: ["Event Intelligence", () => "AI Event Watch"],
  calendar: ["Schedule", () => "Training calendar"],
  medals: ["Achievements", () => "Medal cabinet"],
  vault: ["Secure Storage", () => "Document vault"],
  profile: ["Athlete", () => "Profile and competition class"],
  weight: ["Performance", () => "Weight tracker"],
  checklist: ["Competition Ready", () => "Tournament checklist"],
  travel: ["Weather and Travel", () => "Travel readiness"]
};

function save() {
  Object.keys(defaultState).forEach(key => writeStore(key, state[key]));
}

function toast(message, tone = "info") {
  const toastEl = $("#toast");
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.classList.add("show");
  window.setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function notify(title, body, type = "info") {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    title,
    body,
    type,
    read: false,
    at: new Date().toISOString()
  });
  save();
}

function button(label, action, variant = "", iconName = "") {
  const iconMarkup = iconName ? icon(iconName) : "";
  return `<button class="btn ${variant}" data-action="${esc(action)}" type="button">${iconMarkup}<span>${esc(label)}</span></button>`;
}

function emptyState(title, body, action = "", actionLabel = "") {
  return `<div class="empty" role="status">
    <strong>${esc(title)}</strong>
    <p>${esc(body)}</p>
    ${action ? button(actionLabel, action, "primary", "plus") : ""}
  </div>`;
}

function metric(label, value, detail, iconName = "activity") {
  return `<article class="metric card">
    <div class="metric-icon">${icon(iconName)}</div>
    <div>
      <p>${esc(label)}</p>
      <strong>${esc(value)}</strong>
      <small>${esc(detail)}</small>
    </div>
  </article>`;
}

function getNextEvent() {
  return [...state.events].sort((a, b) => a.date.localeCompare(b.date))[0];
}

function readinessScore() {
  const checklist = state.checklist.length ? state.checklist.filter(item => item.done).length / state.checklist.length : 0;
  const training = state.training.length ? state.training.filter(item => item.done).length / state.training.length : 0;
  return Math.round(checklist * 45 + training * 35 + 20);
}

function renderDashboard() {
  const next = getNextEvent();
  const done = state.checklist.filter(item => item.done).length;
  const completed = state.training.filter(item => item.done).length;
  const score = readinessScore();
  const update = next?.updates?.[0];
  const nextTraining = state.training.find(item => !item.done);

  return `<section class="hero card">
    <div class="hero-copy">
      <span class="pill">Next Competition</span>
      <h2>${esc(next?.name || "No tournament tracked")}</h2>
      <p>${esc(next?.venue || "Add a tournament to begin your event watch.")}</p>
      <div class="hero-meta"><b>${next ? daysUntil(next.date) : 0} days</b><span>to ${next ? formatDate(next.date) : "your goal"}</span></div>
      ${button("Open event watch", "events", "primary", "radar")}
    </div>
    <div class="countdown" aria-label="Competition readiness score">
      <span>Readiness</span>
      <strong>${score}%</strong>
      <small>Competition score</small>
    </div>
  </section>
  <section class="metrics" aria-label="Athlete metrics">
    ${metric("Current weight", `${state.weights.at(-1)} kg`, `Target ${state.profile.weightCategory}`, "activity")}
    ${metric("Training", `${completed} / ${state.training.length}`, "Sessions completed", "calendar")}
    ${metric("Checklist", `${done} / ${state.checklist.length}`, "Items ready", "check")}
    ${metric("Updates", state.notifications.filter(item => !item.read).length, "Unread alerts", "bell")}
  </section>
  <section class="grid two">
    <article class="card panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Latest Event Update</p>
          <h3>${esc(update?.summary || "No verified updates yet")}</h3>
        </div>
        <span class="verified">${update ? "Verified" : "Watching"}</span>
      </div>
      <p>${esc(update?.changes?.join(" ") || "Run a manual scan from Event Watch after adding an official source.")}</p>
      ${button("Scan official source", "scan-event", "primary", "scan")}
    </article>
    <article class="card panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Up Next</p>
          <h3>${esc(nextTraining?.title || "All training complete")}</h3>
        </div>
        ${button("Training log", "calendar", "", "calendar")}
      </div>
      <p>${nextTraining ? `${nextTraining.minutes} minute session planned for ${formatDate(nextTraining.date)}.` : "Great work. Add your next training session from the calendar."}</p>
    </article>
  </section>`;
}

function renderEvents() {
  const rows = state.events.map((event, index) => {
    const eventDate = new Date(`${event.date}T12:00:00`);
    return `<article class="card event">
      <div class="event-date">
        <b>${eventDate.toLocaleDateString("en", { month: "short" }).toUpperCase()}</b>
        <strong>${eventDate.getDate()}</strong>
      </div>
      <div class="event-main">
        <div class="panel-head">
          <h3>${esc(event.name)}</h3>
          <span class="verified">${event.verified ? "Verified" : "Needs review"}</span>
        </div>
        <p>${esc(event.venue)}</p>
        <small>${esc(event.status)}${event.sourceUrl ? " | source linked" : ""}</small>
      </div>
      <div class="event-actions">
        ${button("Details", `event-${index}`, "", "radar")}
        <button class="plain danger" data-action="remove-event-${index}" type="button">${icon("trash")}<span>Remove</span></button>
      </div>
    </article>`;
  }).join("");

  return `<div class="page-actions">
    ${button("Track tournament", "add-event", "primary", "plus")}
    ${button("Manual scan", "scan-event", "", "scan")}
  </div>
  <section class="scan card">
    <div class="scanner">${icon("radar")}</div>
    <div>
      <span class="pill">Official-source watch</span>
      <h2>Changes that matter, saved locally.</h2>
      <p>Add an official website or paste circular text. AthleteOS summarizes material changes, registration notes, dates, and follow-up actions.</p>
    </div>
  </section>
  <section class="list">${rows || emptyState("No tournaments tracked", "Add your first competition to begin monitoring official updates.", "add-event", "Track tournament")}</section>`;
}

function renderCalendar() {
  const first = new Date(state.year, state.month, 1);
  const last = new Date(state.year, state.month + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  const today = new Date();
  const cells = Array.from({ length: leading + last.getDate() }, (_, index) => {
    if (index < leading) return "<div></div>";
    const day = index - leading + 1;
    const hasItem = state.calendar.some(item => {
      const value = new Date(`${item.date}T12:00:00`);
      return value.getDate() === day && value.getMonth() === state.month && value.getFullYear() === state.year;
    });
    const isToday = today.getDate() === day && today.getMonth() === state.month && today.getFullYear() === state.year;
    return `<div class="day ${isToday ? "today" : ""}"><b>${day}</b>${hasItem ? "<i></i>" : ""}</div>`;
  }).join("");

  const rows = [...state.calendar].sort((a, b) => a.date.localeCompare(b.date)).map(item => {
    const originalIndex = state.calendar.indexOf(item);
    return `<div class="schedule-row">
      <span class="type ${esc(item.type).toLowerCase()}">${esc(item.type)}</span>
      <div><b>${esc(item.title)}</b><p>${formatDate(item.date)}</p></div>
      <button class="plain danger" data-action="remove-calendar-${originalIndex}" type="button">${icon("trash")}<span>Remove</span></button>
    </div>`;
  }).join("");

  return `<div class="page-actions">
    ${button("Add schedule item", "add-calendar", "primary", "plus")}
    ${button("Log training", "add-training", "", "activity")}
  </div>
  <section class="card calendar-card">
    <div class="month">
      <button data-action="prev-month" type="button" aria-label="Previous month">${icon("chevronLeft")}</button>
      <h2>${first.toLocaleDateString("en", { month: "long", year: "numeric" })}</h2>
      <button data-action="next-month" type="button" aria-label="Next month">${icon("chevronRight")}</button>
    </div>
    <div class="weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `<span>${day}</span>`).join("")}</div>
    <div class="days">${cells}</div>
  </section>
  <section class="card panel schedule">
    <div class="panel-head"><h3>Upcoming schedule</h3><span>${state.calendar.length}</span></div>
    ${rows || emptyState("No schedule items", "Add training, travel, weigh-in, or school commitments.", "add-calendar", "Add item")}
  </section>`;
}

function renderMedals() {
  const rows = state.medals.map((medal, index) => `<article class="card medal ${esc(medal.medal).toLowerCase()}">
    <div class="medal-icon">${icon("trophy")}</div>
    <span>${esc(medal.medal).toUpperCase()}</span>
    <h3>${esc(medal.event)}</h3>
    <p>${esc(medal.category)}</p>
    <small>${formatDate(medal.date)}</small>
    <button class="plain danger" data-action="remove-medal-${index}" type="button">${icon("trash")}<span>Remove</span></button>
  </article>`).join("");

  return `<div class="page-actions">${button("Add achievement", "add-medal", "primary", "plus")}</div>
  <section class="metrics">
    ${metric("Gold medals", state.medals.filter(item => item.medal.toLowerCase() === "gold").length, "Career total", "medal")}
    ${metric("Podium finishes", state.medals.length, "All saved results", "trophy")}
    ${metric("Latest result", state.medals[0]?.medal || "-", state.medals[0]?.event || "No result", "activity")}
  </section>
  <section class="medal-grid">${rows || emptyState("No achievements added", "Save medals manually or scan a certificate from the vault.", "add-medal", "Add achievement")}</section>`;
}

function renderVault() {
  const rows = state.docs.map((doc, index) => `<article class="card document">
    <span class="doc-icon">${icon("folder")}</span>
    <div><h3>${esc(doc.name)}</h3><p><span class="tag">${esc(doc.tag)}</span> Expires ${doc.expiry ? formatDate(doc.expiry) : "not set"}</p></div>
    <button class="plain danger" data-action="remove-doc-${index}" type="button">${icon("trash")}<span>Remove</span></button>
  </article>`).join("");

  return `<div class="page-actions">
    ${button("Add document", "add-doc", "primary", "plus")}
    ${button("Scan certificate", "scan-certificate", "", "scan")}
  </div>
  <section class="vault-intro card">
    <span>${icon("shield")}</span>
    <div><h2>Competition documents, organized.</h2><p>Metadata stays on this device. Certificate scanning creates a reviewable achievement draft before saving.</p></div>
  </section>
  <section class="document-list">${rows || emptyState("No documents saved", "Add certificates, medical forms, ID cards, and registration documents.", "add-doc", "Add document")}</section>`;
}

function renderProfile() {
  const profile = state.profile;
  return `<section class="profile-layout">
    <article class="card athlete-card">
      <div class="avatar">${esc(initials(profile.name))}</div>
      <h2>${esc(profile.name)}</h2>
      <p>${esc(profile.ageCategory)} Taekwondo athlete</p>
      <div class="belt">${esc(profile.belt).toUpperCase()} <span></span></div>
      <hr>
      <dl>
        <div><dt>Coach</dt><dd>${esc(profile.coach)}</dd></div>
        <div><dt>School</dt><dd>${esc(profile.school)}</dd></div>
        <div><dt>Age category</dt><dd>${esc(profile.ageCategory)}</dd></div>
        <div><dt>Weight category</dt><dd>${esc(profile.weightCategory)}</dd></div>
      </dl>
    </article>
    <article class="card panel">
      <div class="panel-head"><h3>Competition profile</h3>${button("Edit profile", "edit-profile", "", "user")}</div>
      <div class="profile-copy">
        <h4>Competition objective</h4>
        <p>${esc(profile.objective)}</p>
        <h4>Data controls</h4>
        <div class="inline-actions">${button("Export local data", "export-data", "", "download")}${button("Restore sample data", "reset-data", "", "activity")}</div>
      </div>
    </article>
  </section>`;
}

function renderWeight() {
  const last = state.weights.at(-1) || 0;
  const min = Math.min(...state.weights);
  const max = Math.max(...state.weights);
  const range = Math.max(0.1, max - min);
  const bars = state.weights.map((weight, index) => `<div>
    <i style="height:${((weight - min) / range) * 70 + 18}%"></i>
    <span>${weight}</span>
    <small>${index + 1}</small>
  </div>`).join("");

  return `<div class="page-actions">${button("Log weight", "add-weight", "primary", "plus")}</div>
  <section class="metrics">
    ${metric("Current weight", `${last} kg`, "Latest entry", "activity")}
    ${metric("Target class", state.profile.weightCategory, `${(last - 58).toFixed(1)} kg to 58.0`, "gauge")}
    ${metric("7-entry change", `${(last - state.weights[0]).toFixed(1)} kg`, "Trend", "calendar")}
  </section>
  <article class="card chart">
    <div class="panel-head"><div><p class="eyebrow">Weight History</p><h3>Last ${state.weights.length} entries</h3></div></div>
    <div class="bars">${bars}</div>
  </article>`;
}

function renderChecklist() {
  const done = state.checklist.filter(item => item.done).length;
  const percent = Math.round(done / Math.max(1, state.checklist.length) * 100);
  const rows = state.checklist.map((item, index) => `<label class="check-row">
    <input type="checkbox" data-check="${index}" ${item.done ? "checked" : ""}>
    <span></span>
    <b>${esc(item.item)}</b>
    <small>${item.done ? "Ready" : "To pack"}</small>
    <button type="button" class="plain danger" data-action="remove-check-${index}">${icon("trash")}<span>Remove</span></button>
  </label>`).join("");

  return `<div class="page-actions">${button("Add item", "add-check", "primary", "plus")}</div>
  <section class="check-hero card">
    <div><span class="pill">Competition Prep</span><h2>${done} of ${state.checklist.length} items ready</h2><p>Complete your kit before travel day.</p></div>
    <div class="ring" style="background:conic-gradient(#48dbb2 0 ${percent}%,#1b3551 ${percent}% 100%)"><b>${percent}%</b></div>
  </section>
  <section class="check-list card">${rows || emptyState("Checklist is empty", "Add gear, documents, hydration, and travel items.", "add-check", "Add item")}</section>`;
}

function renderTravel() {
  const next = getNextEvent();
  const weather = state.weather;
  const weatherPanel = state.loading === "weather"
    ? `<div class="loading"><span></span><p>Checking travel weather...</p></div>`
    : weather
      ? `<div class="weather-grid">
          ${metric("Location", weather.place, "Open-Meteo forecast", "cloud")}
          ${metric("Temperature", `${weather.current.temperature_2m} C`, `Feels ${weather.current.apparent_temperature} C`, "activity")}
          ${metric("Wind", `${weather.current.wind_speed_10m} km/h`, "Current speed", "gauge")}
        </div>`
      : emptyState("No weather loaded", "Fetch current weather for the next competition city or enter a city manually.", "load-weather", "Check weather");

  return `<section class="grid two">
    <article class="card panel">
      <div class="panel-head"><div><p class="eyebrow">Travel Watch</p><h3>${esc(next?.venue || "No event venue saved")}</h3></div>${button("Check weather", "load-weather", "primary", "cloud")}</div>
      <p>Use weather as a travel-readiness signal before weigh-ins, outdoor warmups, and commute planning.</p>
      <label class="inline-label">City <input id="weather-city" value="${esc(next?.venue?.split(",").at(-1)?.trim() || "New Delhi")}" autocomplete="address-level2"></label>
    </article>
    <article class="card panel">${weatherPanel}</article>
  </section>`;
}

const renderers = {
  dashboard: renderDashboard,
  events: renderEvents,
  calendar: renderCalendar,
  medals: renderMedals,
  vault: renderVault,
  profile: renderProfile,
  weight: renderWeight,
  checklist: renderChecklist,
  travel: renderTravel
};

function render() {
  const [kicker, title] = titles[state.page];
  $("#nav").innerHTML = navigation.map(([id, label, iconName]) => `<button class="nav-item ${id === state.page ? "active" : ""}" data-page="${id}" type="button" aria-current="${id === state.page ? "page" : "false"}">${icon(iconName)}<span>${esc(label)}</span></button>`).join("");
  $("#section-kicker").textContent = kicker;
  $("#page-title").textContent = title();
  $("#profile-chip").innerHTML = `<span>${esc(initials(state.profile.name))}</span><b>${esc(state.profile.name)}</b>`;
  $("#notify").classList.toggle("has-alerts", state.notifications.some(item => !item.read));
  $("#content").innerHTML = renderers[state.page]();
  $("#app-footer").textContent = `AthleteOS v${APP_VERSION} | Copyright (c) 2026 ${ORGANIZATION}`;
}

function showForm(title, fields, submit) {
  $("#modal-body").innerHTML = `<p class="eyebrow">AthleteOS</p><h2>${esc(title)}</h2>${fields.map(field => `<label>${esc(field.label)}
    <input ${field.required === false ? "" : "required"} name="${esc(field.name)}" type="${esc(field.type || "text")}" value="${esc(field.value || "")}" placeholder="${esc(field.placeholder || "")}">
  </label>`).join("")}<button class="btn primary" value="default" type="submit">${icon("check")}<span>Save</span></button>`;

  const modal = $("#modal");
  $("#modal-form").onsubmit = event => {
    event.preventDefault();
    submit(Object.fromEntries(new FormData(event.currentTarget)));
    modal.close();
    save();
    render();
    toast("Saved locally.", "success");
  };
  modal.showModal();
}

function showEventDetails(index) {
  const event = state.events[index];
  $("#modal-body").innerHTML = `<p class="eyebrow">Event Details</p>
    <h2>${esc(event.name)}</h2>
    <p>${esc(event.venue)} | ${formatDate(event.date)}</p>
    <p>${esc(event.status)}</p>
    <h3>Official source</h3>
    <p>${event.sourceUrl ? `<a href="${esc(event.sourceUrl)}" target="_blank" rel="noreferrer">${esc(event.sourceUrl)}</a>` : "No source URL saved. Paste source text during setup or edit the event later."}</p>
    <h3>Update history</h3>
    ${event.updates?.length ? event.updates.map(update => `<div class="update"><div><b>${esc(update.summary)}</b><p>${esc(update.changes?.join(" | ") || "No material changes")}</p><small>${formatDate(update.scannedAt?.slice(0, 10))}</small></div></div>`).join("") : "<p>No scans yet.</p>"}
    ${button("Scan now", `scan-${index}`, "primary", "scan")}`;
  $("#modal").showModal();
}

async function scanEvent(index) {
  const event = state.events[index];
  $("#modal").close();
  state.loading = "scan";
  toast("Reading the official source and preparing a verified summary...");
  try {
    const update = await api("/api/event-scan", {
      method: "POST",
      body: JSON.stringify({
        eventName: event.name,
        sourceUrl: event.sourceUrl,
        sourceText: event.sourceText
      })
    });
    event.updates = [update, ...(event.updates || [])];
    event.status = update.summary;
    event.verified = update.confidence === "verified";
    notify(`${event.name}: source scan complete`, update.summary, event.verified ? "success" : "info");
    save();
    toast(update.localFallback ? "Source saved for manual review." : "Official update saved.", update.localFallback ? "warning" : "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.loading = "";
    render();
  }
}

async function scanCertificate() {
  $("#modal-body").innerHTML = `<p class="eyebrow">Certificate Scanner</p>
    <h2>Extract achievement details</h2>
    <label>Certificate image<input id="certificate-image" type="file" accept="image/*" required></label>
    <button class="btn primary" id="certificate-submit" type="button">${icon("scan")}<span>Scan certificate</span></button>`;
  $("#modal").showModal();
  $("#certificate-submit").onclick = async () => {
    const file = $("#certificate-image").files[0];
    if (!file) {
      toast("Choose a certificate image first.", "warning");
      return;
    }
    toast("Scanning certificate...");
    try {
      const result = await api("/api/certificate-scan", {
        method: "POST",
        body: JSON.stringify({ imageData: await imageToDataUrl(file) })
      });
      $("#modal").close();
      showForm("Review scanned achievement", [
        { label: "Event", name: "event", value: result.event },
        { label: "Medal", name: "medal", value: result.medal },
        { label: "Category", name: "category", value: result.category },
        { label: "Date", name: "date", type: "date", value: result.date }
      ], values => state.medals.unshift(values));
      if (result.needsManualReview) toast(result.message, "warning");
    } catch (error) {
      toast(error.message, "error");
    }
  };
}

async function loadWeather() {
  const input = $("#weather-city");
  const city = input?.value?.trim() || "New Delhi";
  state.loading = "weather";
  render();
  try {
    state.weather = await api(`/api/weather?city=${encodeURIComponent(city)}`);
    toast("Weather updated.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.loading = "";
    render();
  }
}

function exportData() {
  const payload = Object.fromEntries(Object.keys(defaultState).map(key => [key, state[key]]));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "athleteos-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function showNotifications() {
  const notifications = state.notifications;
  notifications.forEach(item => { item.read = true; });
  save();
  $("#modal-body").innerHTML = `<p class="eyebrow">Notifications</p><h2>Updates</h2>${notifications.length ? notifications.slice(0, 12).map(item => `<div class="update"><div><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${new Date(item.at).toLocaleString("en-IN")}</small></div></div>`).join("") : "<p>Nothing new yet.</p>"}`;
  $("#modal").showModal();
  render();
}

function handleAction(action) {
  if (titles[action]) {
    state.page = action;
    render();
    return;
  }

  if (action === "add-event") {
    showForm("Track a tournament", [
      { label: "Tournament name", name: "name" },
      { label: "Date", name: "date", type: "date" },
      { label: "Venue", name: "venue" },
      { label: "Official source URL", name: "sourceUrl", type: "url", required: false },
      { label: "Official update text", name: "sourceText", required: false }
    ], values => {
      state.events.push({ ...values, status: "Watching official sources", verified: false, updates: [] });
      notify("Tournament tracked", `${values.name} was added to Event Watch.`);
    });
    return;
  }

  if (action === "scan-event") {
    if (!state.events.length) toast("Add a tournament first.", "warning");
    else showEventDetails(0);
    return;
  }

  if (action === "add-calendar") return showForm("Add schedule item", [
    { label: "Title", name: "title" },
    { label: "Date", name: "date", type: "date" },
    { label: "Type", name: "type", placeholder: "Training, School, Travel" }
  ], values => state.calendar.push(values));

  if (action === "add-training") return showForm("Log training session", [
    { label: "Session title", name: "title" },
    { label: "Date", name: "date", type: "date" },
    { label: "Minutes", name: "minutes", type: "number" }
  ], values => {
    state.training.push({ ...values, minutes: Number(values.minutes), done: true });
    state.calendar.push({ title: values.title, date: values.date, type: "Training" });
  });

  if (action === "add-medal") return showForm("Add achievement", [
    { label: "Event", name: "event" },
    { label: "Medal", name: "medal", placeholder: "Gold, Silver or Bronze" },
    { label: "Category", name: "category" },
    { label: "Date", name: "date", type: "date" }
  ], values => state.medals.unshift(values));

  if (action === "add-doc") return showForm("Add document", [
    { label: "Document name", name: "name" },
    { label: "Type", name: "tag", placeholder: "Medical, Identity, Registration" },
    { label: "Expiry date", name: "expiry", type: "date", required: false }
  ], values => state.docs.push(values));

  if (action === "edit-profile") return showForm("Edit athlete profile", [
    { label: "Name", name: "name", value: state.profile.name },
    { label: "Coach", name: "coach", value: state.profile.coach },
    { label: "School", name: "school", value: state.profile.school },
    { label: "Belt rank", name: "belt", value: state.profile.belt },
    { label: "Age category", name: "ageCategory", value: state.profile.ageCategory },
    { label: "Weight category", name: "weightCategory", value: state.profile.weightCategory },
    { label: "Competition objective", name: "objective", value: state.profile.objective }
  ], values => { state.profile = values; });

  if (action === "add-weight") return showForm("Log current weight", [
    { label: "Weight (kg)", name: "weight", type: "number", value: state.weights.at(-1) }
  ], values => state.weights.push(Number(values.weight)));

  if (action === "add-check") return showForm("Add checklist item", [
    { label: "Item", name: "item" }
  ], values => state.checklist.push({ ...values, done: false }));

  if (action === "scan-certificate") return scanCertificate();
  if (action === "export-data") return exportData();
  if (action === "load-weather") return loadWeather();

  if (action === "reset-data") {
    Object.entries(defaultState).forEach(([key, value]) => { state[key] = clone(value); });
    save();
    render();
    toast("Sample data restored.", "success");
    return;
  }

  if (action === "prev-month" || action === "next-month") {
    state.month += action === "prev-month" ? -1 : 1;
    if (state.month < 0) { state.month = 11; state.year -= 1; }
    if (state.month > 11) { state.month = 0; state.year += 1; }
    render();
    return;
  }

  let match = action.match(/^event-(\d+)$/);
  if (match) return showEventDetails(Number(match[1]));

  match = action.match(/^scan-(\d+)$/);
  if (match) return scanEvent(Number(match[1]));

  match = action.match(/^remove-(event|calendar|medal|doc|check)-(\d+)$/);
  if (match) {
    const collections = { event: "events", calendar: "calendar", medal: "medals", doc: "docs", check: "checklist" };
    state[collections[match[1]]].splice(Number(match[2]), 1);
    save();
    render();
    toast("Removed.", "success");
  }
}

document.addEventListener("click", event => {
  const page = event.target.closest("[data-page]");
  if (page) {
    state.page = page.dataset.page;
    render();
  }

  const action = event.target.closest("[data-action]");
  if (action) handleAction(action.dataset.action);
});

document.addEventListener("change", event => {
  if (event.target.matches("[data-check]")) {
    state.checklist[Number(event.target.dataset.check)].done = event.target.checked;
    save();
    render();
  }
});

$("#notify").onclick = showNotifications;
render();

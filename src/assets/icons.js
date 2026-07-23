const paths = {
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  check: "M20 6 9 17l-5-5",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  cloud: "M17.5 19H7a5 5 0 1 1 1.2-9.85A7 7 0 0 1 21 12a4 4 0 0 1-3.5 7Z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  folder: "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  gauge: "M12 14l4-4 M3.34 19a10 10 0 1 1 17.32 0",
  medal: "M7 2l5 7 5-7 M8 21h8 M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  plus: "M12 5v14 M5 12h14",
  radar: "M13.5 10.5 21 3 M21 12a9 9 0 1 1-9-9 M12 8a4 4 0 1 0 4 4",
  scan: "M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 12h10",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  trash: "M3 6h18 M8 6V4h8v2 M6 6l1 16h10l1-16",
  trophy: "M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0V4Z M5 5H3v2a4 4 0 0 0 4 4 M19 5h2v2a4 4 0 0 1-4 4",
  user: "M20 21a8 8 0 1 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  x: "M18 6 6 18 M6 6l12 12"
};

export function icon(name, label = "") {
  const title = label ? `<title>${label}</title>` : "";
  return `<svg class="icon" aria-hidden="${label ? "false" : "true"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${title}<path d="${paths[name] || paths.gauge}"></path></svg>`;
}

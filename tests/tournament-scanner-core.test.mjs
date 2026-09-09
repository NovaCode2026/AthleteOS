import test from "node:test";
import assert from "node:assert/strict";
import { extractDate, normalizeText, scanPage } from "../netlify/functions/tournament-scanner-core.mjs";

test("normalizes HTML into searchable text", () => {
  assert.equal(normalizeText("<script>x</script><h1>Taekwondo&nbsp;Open</h1>"), "Taekwondo Open");
});

test("extracts common Indian date format", () => {
  assert.equal(extractDate("07/12/2026"), "2026-12-07");
});

test("extracts tournament fields and PDF notices without AI", () => {
  const html = `
    <html><head><title>North India Taekwondo Open</title></head>
    <body>
      Tournament Date: 7 December 2026
      Venue: Noida Indoor Stadium
      Registration Deadline: 30 November 2026
      Weigh-in: 6 December, 8:00 AM
      Categories: Cadet Under 49 kg
      <a href="/notice.pdf">Official Notice PDF</a>
    </body></html>`;

  const result = scanPage(html, "https://example.org/events");
  assert.equal(result.tournament_name, "North India Taekwondo Open");
  assert.equal(result.tournament_date, "2026-12-07");
  assert.equal(result.venue, "Noida Indoor Stadium");
  assert.equal(result.registration_deadline, "2026-11-30");
  assert.match(result.weigh_in_information, /6 December/);
  assert.equal(result.categories, "Cadet Under 49 kg");
  assert.equal(result.pdfs[0].href, "https://example.org/notice.pdf");
});

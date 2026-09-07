import assert from "node:assert/strict";
import { calculateReadiness } from "../src/utils/readiness.js";

const emptyScore = calculateReadiness({ profile: {}, training: [], goals: [], tournaments: [], weights: [], documents: [] });
assert.equal(emptyScore, 0);

const completeScore = calculateReadiness({
  profile: {
    full_name: "Athlete",
    belt: "Black",
    academy: "Academy",
    coach: "Coach",
    emergency_contact: "Family",
    verified_athlete: true
  },
  training: Array.from({ length: 10 }, (_, index) => ({
    title: `Session ${index}`,
    session_date: new Date().toISOString().slice(0, 10),
    minutes: 60
  })),
  goals: [{ title: "Win nationals", progress: 80 }],
  tournaments: [{ name: "Open", starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }],
  weights: Array.from({ length: 5 }, (_, index) => ({ logged_at: "2026-08-01", weight_kg: 60 + index })),
  documents: Array.from({ length: 3 }, (_, index) => ({ title: `Doc ${index}`, document_type: "id" }))
});

assert.ok(completeScore > emptyScore);
assert.ok(completeScore <= 100);

console.log("Logic tests passed.");

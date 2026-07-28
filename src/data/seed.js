export const seed = {
  profile: {
    full_name: "Arjun Kumar",
    belt: "Blue belt",
    academy: "Delhi Taekwondo Academy",
    coach: "R. Mehta",
    weight_kg: 57.8,
    height_cm: 168,
    emergency_contact: "Parent / Guardian"
  },
  tournaments: [
    { name: "National Taekwondo Championship", starts_at: "2026-08-14", location: "New Delhi", status: "watching", result: "Pending" }
  ],
  training: [
    { title: "Sparring and reaction drills", session_date: "2026-07-15", minutes: 90, intensity: "high" },
    { title: "Strength and conditioning", session_date: "2026-07-16", minutes: 60, intensity: "medium" }
  ],
  medals: [
    { event_name: "Delhi State Open", medal_type: "Gold", category: "Junior -58 kg", awarded_at: "2026-03-08" }
  ],
  weights: [
    { logged_at: "2026-07-10", weight_kg: 58.6 },
    { logged_at: "2026-07-12", weight_kg: 58.2 },
    { logged_at: "2026-07-14", weight_kg: 57.9 },
    { logged_at: "2026-07-16", weight_kg: 57.8 }
  ],
  goals: [
    { title: "Competition readiness", target_date: "2026-08-14", status: "active", progress: 72 }
  ],
  checklist: [
    { item: "Dobok and belt", category: "equipment", completed: true },
    { item: "Guards and gloves", category: "equipment", completed: true },
    { item: "Medical certificate", category: "medical", completed: false }
  ]
};

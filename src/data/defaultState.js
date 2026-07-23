export const APP_VERSION = "1.0.0";
export const ORGANIZATION = "Nova Code";

export const defaultState = {
  profile: {
    name: "Arjun Kumar",
    coach: "R. Mehta",
    school: "Delhi Public School",
    belt: "Blue belt",
    ageCategory: "Junior",
    weightCategory: "-58 kg",
    objective: "Build consistency for the National Taekwondo Championship."
  },
  events: [
    {
      name: "National Taekwondo Championship",
      date: "2026-08-14",
      venue: "Indira Gandhi Indoor Stadium, New Delhi",
      sourceUrl: "",
      sourceText: "",
      status: "Watching official sources",
      verified: true,
      updates: []
    }
  ],
  calendar: [
    { title: "Strength and conditioning", date: "2026-07-16", type: "Training" },
    { title: "Weigh-in reminder", date: "2026-08-13", type: "Competition" }
  ],
  medals: [
    { event: "Delhi State Open", medal: "Gold", category: "Junior -58 kg", date: "2026-03-08" }
  ],
  docs: [
    { name: "Medical Fitness Certificate", tag: "Medical", expiry: "2027-01-15" }
  ],
  weights: [58.6, 58.4, 58.2, 58.1, 57.9, 57.8, 57.8],
  checklist: [
    { item: "Dobok and belt", done: true },
    { item: "Guards and gloves", done: true },
    { item: "Mouth guard", done: false },
    { item: "ID card and registration", done: false },
    { item: "Water bottle", done: true }
  ],
  training: [
    { title: "Sparring and reaction drills", date: "2026-07-15", minutes: 90, done: true },
    { title: "Strength and conditioning", date: "2026-07-16", minutes: 60, done: false }
  ],
  notifications: []
};

export const navigation = [
  ["dashboard", "Dashboard", "gauge"],
  ["events", "AI Event Watch", "radar"],
  ["calendar", "Calendar", "calendar"],
  ["medals", "Medal Cabinet", "medal"],
  ["vault", "Document Vault", "folder"],
  ["profile", "Athlete Profile", "user"],
  ["weight", "Weight Tracker", "activity"],
  ["checklist", "Checklist", "check"],
  ["travel", "Weather and Travel", "cloud"]
];

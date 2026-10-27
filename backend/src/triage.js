// SMART TRIAGE: keyword scoring (priority + category + location) and token-overlap clustering.
// No external API needed: pure functions, easy to explain in the viva.
const URGENT = { fire: 5, smoke: 4, "short circuit": 5, sparking: 4, spark: 3, shock: 4, electrocut: 5, gas: 4, flood: 3, "water leak": 2, harassment: 5, ragging: 5, injury: 4, injured: 4, emergency: 5, unsafe: 3, theft: 3, broken: 1, urgent: 2, "not working": 1, "no water": 2 };
const CAT_WORDS = {
  WiFi: ["wifi", "wi-fi", "internet", "network", "router", "lan", "signal", "bandwidth"],
  Hostel: ["hostel", "warden", "bed", "mess", "laundry", "geyser", "water", "room"],
  Classroom: ["classroom", "projector", "bench", "lab", "fan", "ac", "board", "lecture"],
  Library: ["library", "books", "reading", "librarian"],
  Canteen: ["canteen", "food", "cafeteria", "meal", "hygiene"]
};
const LOCATIONS = ["Block A", "Block B", "Block C", "Block D", "Hostel 1", "Hostel 2", "Library", "Canteen", "Other"];
const STOP = new Set(["the", "is", "are", "not", "in", "at", "of", "a", "an", "and", "to", "for", "from", "on", "my", "our", "since", "has", "have", "very", "again"]);
const RANK = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const words = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
const similarity = (a, b) => { // Jaccard: shared words / all words
  const A = new Set(words(a)), B = new Set(words(b));
  let shared = 0; A.forEach((w) => B.has(w) && shared++);
  return shared / (A.size + B.size - shared || 1);
};

function detectLocation(text) {
  const t = text.toLowerCase();
  let m = t.match(/block\s*-?\s*([a-d])\b/); if (m) return `Block ${m[1].toUpperCase()}`;
  m = t.match(/hostel\s*-?\s*([12])\b/); if (m) return `Hostel ${m[1]}`;
  if (t.includes("library")) return "Library";
  if (/canteen|cafeteria|mess/.test(t)) return "Canteen";
  return null;
}

// text -> { priority, category, location, score, signals }
function analyze(text, chosenCategory) {
  const t = text.toLowerCase();
  const signals = Object.keys(URGENT).filter((k) => t.includes(k));
  const score = signals.reduce((s, k) => s + URGENT[k], 0);
  const priority = score >= 4 ? "Urgent" : score >= 3 ? "High" : score >= 1 ? "Medium" : "Low";
  let category = "Other", best = 0;
  for (const [cat, list] of Object.entries(CAT_WORDS)) {
    const hits = list.filter((w) => t.includes(w)).length;
    if (hits > best) { best = hits; category = cat; }
  }
  if (chosenCategory && chosenCategory !== "Auto" && chosenCategory !== "Other") category = chosenCategory;
  return { priority, category, location: detectLocation(text) || "Other", score, signals };
}

// Groups similar complaints: same location + same category + (shared topic word OR similar wording)
function annotate(list) {
  const groups = [], info = new Map();
  const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of sorted) {
    const text = `${c.title} ${c.description}`;
    const a = analyze(text, c.category);
    const location = c.location && c.location !== "Auto" ? c.location : a.location;
    const topic = (CAT_WORDS[a.category] || []).filter((w) => text.toLowerCase().includes(w));
    const g = groups.find((x) => x.location === location && x.category === a.category &&
      (x.topic.some((w) => topic.includes(w)) || similarity(x.text, text) >= 0.25));
    const priority = c.priority || a.priority;
    if (g) { g.items.push(c); g.topic.push(...topic); if (RANK[priority] < RANK[g.priority]) g.priority = priority; }
    else groups.push({ id: c.id, location, category: a.category, title: c.title, text, topic, priority, items: [c] });
    info.set(c.id, { priority, location, group: g || groups[groups.length - 1] });
  }
  const out = new Map();
  info.forEach((v, id) => out.set(id, { priority: v.priority, location: v.location, clusterId: v.group.id, clusterSize: v.group.items.length }));
  return { byId: out, groups };
}

function hotspots(list, byId) { // open complaints only; urgent ones weigh more
  const W = { Urgent: 5, High: 3, Medium: 2, Low: 1 };
  const map = Object.fromEntries(LOCATIONS.map((l) => [l, { location: l, score: 0, open: 0, urgent: 0 }]));
  list.filter((c) => c.status !== "Resolved").forEach((c) => {
    const i = byId.get(c.id), h = map[i.location] || map.Other;
    h.score += W[i.priority]; h.open++; if (i.priority === "Urgent") h.urgent++;
  });
  return Object.values(map);
}

// ---- SLA (service level agreement): how many hours a complaint may stay open ----
const SLA_HOURS = { Urgent: 24, High: 48, Medium: 72, Low: 120 };
function slaInfo(c, now = Date.now()) {
  const hours = SLA_HOURS[c.priority] || 72;
  const due = new Date(c.createdAt).getTime() + hours * 3600000;
  const open = c.status !== "Resolved";
  return { slaHours: hours, dueAt: new Date(due).toISOString(), overdue: open && now > due, hoursLeft: Math.round((due - now) / 360000) / 10 };
}

// ---- Departments: which team should fix it ----
const DEPARTMENTS = ["Electrical", "IT", "Hostel", "Maintenance", "Academic"];
const DEPT_FOR_CATEGORY = { WiFi: "IT", Hostel: "Hostel", Classroom: "Maintenance", Library: "Academic", Canteen: "Maintenance", Other: "Maintenance" };
function suggestDept(c) {
  const text = `${c.title} ${c.description}`.toLowerCase();
  if (/short circuit|spark|shock|electric|socket|switchboard|wiring/.test(text)) return "Electrical";
  return DEPT_FOR_CATEGORY[c.category] || "Maintenance";
}

module.exports = { analyze, annotate, hotspots, RANK, LOCATIONS, SLA_HOURS, slaInfo, DEPARTMENTS, suggestDept };

// CampusPulse frontend. ONE script runs both pages; window.PORTAL says "student" or "admin".
// Concepts: Fetch API, async/await, Promises, DOM, events, ES6, JSON, localStorage.
const ROLE = window.PORTAL;
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const KEY = (k) => `${ROLE}_${k}`; // separate storage so admin and student can be logged in side by side

let token = localStorage.getItem(KEY("token"));
let user = JSON.parse(localStorage.getItem(KEY("user")) || "null");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); // anti-XSS
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const cls = (status) => status.replace(" ", "");
const refNo = (c) => `CP-${new Date(c.createdAt).getFullYear()}-${c.id.slice(-5).toUpperCase()}`;

// ---------- Names from config.js ----------
$$(".college").forEach((el) => (el.textContent = window.COLLEGE_NAME || "College"));
$$(".portal-name").forEach((el) => (el.textContent = window.PORTAL_NAME || "Grievance Portal"));
$("#todayDate").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// ---------- Theme button (light / dark) ----------
const root = document.documentElement;
function setTheme(t) {
  root.dataset.theme = t;
  localStorage.setItem("theme", t);
  $$("[data-theme-toggle]").forEach((b) => (b.textContent = t === "dark" ? "Light mode" : "Dark mode"));
}
setTheme(localStorage.getItem("theme") || "light");
$$("[data-theme-toggle]").forEach((b) => (b.onclick = () => { setTheme(root.dataset.theme === "dark" ? "light" : "dark"); if (user && !$("#view-home").classList.contains("hidden")) loadHome(); }));

function toast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.className = `toast show${isError ? " error" : ""}`;
  setTimeout(() => t.classList.remove("show"), 2800);
}

// ONE helper for every API call: adds token, parses JSON, throws on error
async function api(url, { method = "GET", body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) logout(); // token expired
    throw new Error(data.error || "Request failed");
  }
  return data;
}
const safe = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } }; // one place for try/catch

// ---------- Auth ----------
function saveSession(data) {
  ({ token, user } = data);
  localStorage.setItem(KEY("token"), token);
  localStorage.setItem(KEY("user"), JSON.stringify(user));
  showApp();
}
function logout() {
  live?.close(); live = null; $("#bellMenu").classList.add("hidden");
  token = user = null;
  localStorage.removeItem(KEY("token")); localStorage.removeItem(KEY("user"));
  $("#appView").classList.add("hidden");
  $("#authView").classList.remove("hidden");
}
$("#logoutBtn").onclick = logout;

if ($("#tabLogin")) { // student page only
  const switchTab = (toLogin) => {
    $("#loginForm").classList.toggle("hidden", !toLogin);
    $("#registerForm").classList.toggle("hidden", toLogin);
    $("#tabLogin").classList.toggle("active", toLogin);
    $("#tabRegister").classList.toggle("active", !toLogin);
  };
  $("#tabLogin").onclick = () => switchTab(true);
  $("#tabRegister").onclick = () => switchTab(false);
}
const loginPath = ROLE === "admin" ? "admin-login" : "login";
$("#loginForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  saveSession(await api(`/api/auth/${loginPath}`, { method: "POST", body: Object.fromEntries(new FormData(e.target)) }));
}));
$("#registerForm")?.addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  saveSession(await api("/api/auth/register", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }));
}));

// ---------- Shell + navigation ----------
const TITLES = { home: "Dashboard", complaints: "Complaints", community: "Community Board", notices: "Notice Board", events: "Campus Events", users: "Students" };
function showApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#meName").textContent = user.name;
  $("#meRole").textContent = user.role;
  $("#meAvatar").textContent = user.name[0].toUpperCase();
  document.body.dataset.urole = user.role; // "student", "admin" or "staff": CSS hides what this role may not use
  $("#complaintsTitle").textContent = user.role === "admin" ? "All Complaints" : user.role === "staff" ? `${user.dept} Team Complaints` : "My Complaints";
  connectLive(); loadBell();
  openView("home");
}
const loaders = () => ({ home: loadHome, complaints: loadComplaints, community: loadCommunity, notices: loadNotices, events: loadEvents, users: loadUsers }); // function = looked up lazily
function openView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $$(".nav").forEach((n) => n.classList.toggle("active", n.dataset.view === name));
  $("#crumb").innerHTML = `Home &rsaquo; <b>${TITLES[name]}</b>`;
  loaders()[name]();
}
$$(".nav").forEach((n) => (n.onclick = () => openView(n.dataset.view)));

let timer; // debounce: wait until typing stops before calling the API
const debounced = (fn) => () => { clearTimeout(timer); timer = setTimeout(fn, 300); };

// ---------- Dashboard ----------
const MOODS = ["\u{1F61E}", "\u{1F641}", "\u{1F610}", "\u{1F642}", "\u{1F604}"];
const barList = (obj, max) => Object.entries(obj).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${(v / max) * 100}%"></i><b>${v}</b></div>`).join("");
const panel = (title, inner, cls2 = "") => `<section class="panel ${cls2}"><h3>${title}</h3><div class="body">${inner}</div></section>`;

// Location-wise register (replaces the old 3D map): one row per campus location, with a severity meter
function locationRegister(hot) {
  const maxHot = Math.max(1, ...hot.map((h) => h.score));
  const level = (h) => (!h.open ? "None" : h.score / maxHot >= 0.66 ? "Critical" : h.score / maxHot >= 0.33 ? "Attention" : "Normal");
  const rows = [...hot].sort((a, b) => b.score - a.score).map((h) => {
    const lv = level(h);
    return `<tr><td><b>${esc(h.location)}</b></td><td class="num">${h.open}</td><td class="num">${h.urgent}</td>
      <td><span class="meter" title="Severity score ${h.score}"><i class="m-${lv}" style="width:${(h.score / maxHot) * 100}%"></i></span></td>
      <td><span class="lvl ${lv}">${lv === "None" ? "No open complaints" : lv}</span></td></tr>`;
  }).join("");
  return `<div class="tbl-wrap"><table class="reg"><thead><tr><th>Location</th><th class="num">Open</th><th class="num">Urgent</th><th>Severity</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Severity is weighted: Urgent counts more than Low priority complaints.</p>`;
}

function clusterTable(clusters) {
  if (!clusters.length) return `<p class="hint">No complaints yet.</p>`;
  const rows = clusters.slice(0, 8).map((g) => `<tr><td><b>${esc(g.title)}</b><br /><small class="hint">${esc(g.category)}</small></td><td>${esc(g.location)}</td>
    <td class="num">${g.count}</td><td class="num">${g.open}</td><td><span class="badge pri-${g.priority}">${g.priority}</span></td></tr>`).join("");
  return `<div class="tbl-wrap"><table class="reg"><thead><tr><th>Issue</th><th>Location</th><th class="num">Reports</th><th class="num">Open</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Similar complaints are merged, so one issue appears once with its report count.</p>`;
}

let prioChart; // Chart.js instance (destroyed before redraw)
const loadHome = safe(async () => {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#homeTitle").textContent = `${greet}, ${user.name.split(" ")[0]}`;
  $("#homeSub").textContent = user.role === "staff" ? `Complaints assigned to the ${user.dept} team.` : ROLE === "admin" ? "Overview of grievances received by the cell." : "Summary of your grievances and campus updates.";

  // Promise.all = run independent requests at the same time
  const admin = user.role === "admin";
  const [pulse, complaints, stats, hot, clusters] = await Promise.all([
    api("/api/pulse"), api("/api/complaints"), admin ? api("/api/complaints/stats") : null,
    admin ? api("/api/complaints/triage/hotspots") : null, admin ? api("/api/complaints/triage/clusters") : null
  ]);
  const count = (s) => complaints.filter((c) => c.status === s).length;
  const tiles = admin
    ? [["Total complaints", stats.total, ""], ["Pending", stats.byStatus.Pending, ""], ["Overdue (SLA)", stats.overdue, "red"], ["In progress", stats.byStatus["In Progress"], ""], ["Resolved", stats.byStatus.Resolved, "green"]]
    : [[user.role === "staff" ? "Assigned to my team" : "My complaints", complaints.length, ""], ["Pending", count("Pending"), ""], ["Overdue (SLA)", complaints.filter((c) => c.overdue).length, "red"], ["In progress", count("In Progress"), ""], ["Resolved", count("Resolved"), "green"]];

  const week = `<div class="week">${pulse.week.map((d) => `<div><i style="height:${(d.avg / 5) * 100}%"></i><span>${d.avg || "-"}</span><span>${d.day.slice(8)}</span></div>`).join("")}</div><p class="hint">Average of student votes (1 low, 5 high).</p>`;
  const moodBox = ROLE !== "student" ? "" : panel("How is campus feeling today?", `
      <div class="moods">${MOODS.map((m, i) => `<button class="mood ${pulse.mine === i + 1 ? "on" : ""}" data-mood="${i + 1}" aria-label="Mood ${i + 1} of 5">${m}</button>`).join("")}</div>
      <p class="hint">${pulse.today.count ? `${pulse.today.count} student(s) voted today. Average mood ${pulse.today.avg} / 5.` : "Nobody has voted yet. Be the first."}</p>`);

  $("#homeBox").innerHTML = `
    <div class="stat-row">${tiles.map(([l, v, k]) => `<div class="stat ${k}"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    ${admin ? `<div class="cols">${panel("Location-wise complaint register", locationRegister(hot))}${panel("Open complaints by priority", `<canvas id="prioChart" height="200"></canvas>`)}</div>
      ${panel("Grouped issues (duplicate reports merged)", clusterTable(clusters))}` : ""}
    ${moodBox}
    <div class="cols">${panel("Campus mood, last 7 days", week)}${admin ? panel("Complaints by category", `<div class="bars">${barList(stats.byCategory, Math.max(1, ...Object.values(stats.byCategory)))}</div>`) : ""}</div>`;

  if (admin && window.Chart) {
    prioChart?.destroy();
    const n = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
    complaints.filter((c) => c.status !== "Resolved").forEach((c) => n[c.priority]++);
    const text = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    prioChart = new Chart($("#prioChart"), { type: "doughnut", data: { labels: Object.keys(n), datasets: [{ data: Object.values(n), backgroundColor: ["#8b1e2d", "#c2631a", "#a67c00", "#2e7d5b"], borderWidth: 0 }] },
      options: { plugins: { legend: { position: "right", labels: { color: text } } } } });
  }
});
$("#homeBox").addEventListener("click", safe(async (e) => {
  const mood = e.target.closest("[data-mood]")?.dataset.mood;
  if (!mood) return;
  await api("/api/pulse", { method: "POST", body: { mood: Number(mood) } });
  toast("Thank you, your response is recorded"); loadHome();
}));

// ---------- Complaints ----------
const hrs = (h) => { const a = Math.abs(h); return a >= 48 ? `${Math.round(a / 24)} days` : `${Math.round(a)} h`; };
const slaText = (c) => c.status === "Resolved" ? `<span class="sla-ok">Resolved</span>` : c.overdue ? `<span class="sla-bad">Overdue by ${hrs(c.hoursLeft)}</span>` : `<span class="sla-ok">Due in ${hrs(c.hoursLeft)} (${c.slaHours} h SLA)</span>`;
const DEPTS = ["Electrical", "IT", "Hostel", "Maintenance", "Academic"];

const loadComplaints = safe(async () => {
  const params = new URLSearchParams(); // builds ?q=..&status=..
  const status = $("#statusFilter").value;
  if ($("#searchBox").value) params.set("q", $("#searchBox").value);
  if (status && status !== "Overdue") params.set("status", status);
  let list = await api(`/api/complaints?${params}`);
  if (status === "Overdue") list = list.filter((c) => c.overdue);                       // SLA filter (client side)
  const dept = $("#deptFilter").value;
  if (dept) list = list.filter((c) => (dept === "none" ? !c.dept : c.dept === dept));   // department filter (admin)
  const role = user.role, canManage = role === "admin" || role === "staff";
  $("#complaintList").innerHTML = list.length ? list.map((c) => `
    <article class="record pr-${c.priority} ${c.overdue ? "is-overdue" : ""}">
      <header class="rec-head"><span class="ref">${refNo(c)}</span><span>Filed on ${fmtDate(c.createdAt)}</span>${c.overdue ? `<span class="badge overdue">Overdue</span>` : ""}${c.anonymous ? `<span class="badge anon">Anonymous</span>` : ""}<span class="badge st-${cls(c.status)}">${esc(c.status)}</span></header>
      <div class="rec-body">
        <h4>${esc(c.title)}</h4><p>${esc(c.description)}</p>
        <dl class="facts">
          <div><dt>Priority</dt><dd><span class="badge pri-${c.priority}">${c.priority}</span></dd></div>
          <div><dt>Category</dt><dd>${esc(c.category)}</dd></div>
          <div><dt>Location</dt><dd>${esc(c.location)}</dd></div>
          <div><dt>Resolution due</dt><dd>${slaText(c)}</dd></div>
          <div><dt>Department</dt><dd>${esc(c.dept || "Not assigned")}</dd></div>
          ${canManage ? `<div><dt>Filed by</dt><dd>${esc(c.userName)}</dd></div>` : ""}
          ${role === "admin" ? `<div><dt>Similar reports</dt><dd>${c.clusterSize > 1 ? `<span class="chip dup">${c.clusterSize} reports</span>` : "None"}</dd></div>` : ""}
          ${c.public ? `<div><dt>Supporters</dt><dd>${c.supportCount} student(s)</dd></div>` : ""}
          ${c.attachment ? `<div><dt>Attachment</dt><dd><button class="link" data-file="${esc(c.attachment)}">View file</button></dd></div>` : ""}
        </dl>
        ${role === "student" && c.remark ? `<div class="reply"><b>Reply from grievance cell:</b> ${esc(c.remark)}</div>` : ""}
        ${canManage ? `<div class="actions">
          <select data-status="${c.id}" aria-label="Status">${["Pending", "In Progress", "Resolved"].map((x) => `<option ${x === c.status ? "selected" : ""}>${x}</option>`).join("")}</select>
          <input data-remark="${c.id}" placeholder="Reply to the student" value="${esc(c.remark || "")}" />
          <button class="btn primary small" data-save="${c.id}">Update</button></div>` : ""}
        ${role === "admin" ? `<div class="actions">
          <select data-dept="${c.id}" aria-label="Assign department"><option value="">Unassigned</option>${DEPTS.map((d) => `<option value="${d}" ${d === c.dept ? "selected" : ""}>${d}${!c.dept && d === c.suggestedDept ? " (suggested)" : ""}</option>`).join("")}</select>
          <button class="btn ghost small" data-assign="${c.id}">Assign to team</button><button class="btn danger" data-del="${c.id}">Delete</button></div>` : ""}
        ${role === "student" && c.status === "Pending" ? `<div class="actions"><button class="btn danger" data-del="${c.id}">Withdraw</button></div>` : ""}
      </div>
    </article>`).join("") : `<div class="empty">${canManage ? "No complaints match your filters." : "You have not filed any grievance yet. Use the form above to lodge one."}</div>`;
});
$("#complaintList").addEventListener("click", safe(async (e) => {
  const { del, file, save, assign } = e.target.dataset; // event delegation: one listener for all cards
  if (del && confirm("Remove this complaint?")) { await api(`/api/complaints/${del}`, { method: "DELETE" }); toast("Complaint removed"); loadComplaints(); }
  if (save) {
    const status = $(`[data-status="${save}"]`).value, remark = $(`[data-remark="${save}"]`).value;
    await api(`/api/complaints/${save}/status`, { method: "PUT", body: { status, remark } });
    toast("Complaint updated"); loadComplaints();
  }
  if (assign) {
    const dept = $(`[data-dept="${assign}"]`).value;
    await api(`/api/complaints/${assign}/assign`, { method: "PUT", body: { dept } });
    toast(dept ? `Assigned to ${dept} team` : "Assignment cleared"); loadComplaints();
  }
  if (file) { // file route needs the token, so fetch it as a Blob
    const res = await fetch(`/api/files/${file}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Could not open the file");
    window.open(URL.createObjectURL(await res.blob()), "_blank");
  }
}));
$("#complaintForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  await api("/api/complaints", { method: "POST", form: new FormData(e.target) }); // FormData carries the file
  e.target.reset(); $("#triageHint").textContent = "Smart triage will suggest the category, priority and location as you type.";
  toast("Grievance submitted"); loadComplaints();
}));
// live triage suggestion while the student types (debounced)
let previewTimer;
$("#complaintForm").addEventListener("input", () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(safe(async () => {
    const b = Object.fromEntries(new FormData($("#complaintForm")));
    if ((b.title + b.description).trim().length < 6) return;
    const t = await api("/api/complaints/triage/preview", { method: "POST", body: { title: b.title, description: b.description, category: b.category } });
    $("#triageHint").innerHTML = `<b>Smart triage:</b> <span>Priority <span class="badge pri-${t.priority}">${t.priority}</span></span><span>Category <b>${esc(t.category)}</b></span><span>Location <b>${esc(t.location)}</b></span>${t.signals.length ? `<span>Flagged: ${t.signals.map(esc).join(", ")}</span>` : ""}`;
  }), 400);
});
$("#searchBox").addEventListener("input", debounced(loadComplaints));
$("#statusFilter").addEventListener("change", loadComplaints);
$("#deptFilter").addEventListener("change", loadComplaints);

// ---------- Notices ----------
const loadNotices = safe(async () => {
  const list = await api(`/api/notices?q=${encodeURIComponent($("#noticeSearch").value)}`);
  $("#noticeList").innerHTML = list.length ? list.map((n) => {
    const d = new Date(n.createdAt), isNew = Date.now() - d < 7 * 86400000;
    return `<article class="row"><div class="date"><b>${d.getDate()}</b><span>${d.toLocaleString("en-IN", { month: "short" })}</span></div>
      <div><h4>${esc(n.title)}${isNew ? `<span class="new">NEW</span>` : ""}</h4><p>${esc(n.body)}</p></div>
      ${ROLE === "admin" ? `<div class="actions"><button class="btn danger" data-ndel="${n.id}">Remove</button></div>` : ""}</article>`;
  }).join("") : `<div class="empty">No notices match your search.</div>`;
});
$("#noticeSearch").addEventListener("input", debounced(loadNotices));
$("#noticeList").addEventListener("click", safe(async (e) => {
  const id = e.target.dataset.ndel;
  if (id) { await api(`/api/notices/${id}`, { method: "DELETE" }); toast("Notice removed"); loadNotices(); }
}));
$("#noticeForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  await api("/api/notices", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
  e.target.reset(); toast("Notice published"); loadNotices();
}));

// ---------- Events ----------
const loadEvents = safe(async () => {
  const list = await api("/api/events");
  $("#eventList").innerHTML = list.length ? list.map((ev) => {
    const d = new Date(ev.date);
    return `<article class="row"><div class="date"><b>${d.getDate()}</b><span>${d.toLocaleString("en-IN", { month: "short" })}</span></div>
      <div><h4>${esc(ev.title)}</h4><p>Venue: ${esc(ev.venue)}${ev.description ? ` &middot; ${esc(ev.description)}` : ""}</p><p>${ev.going} registered</p></div>
      <div class="actions">${ROLE === "admin" ? `<button class="btn danger" data-edel="${ev.id}">Delete</button>`
        : `<button class="btn ${ev.joined ? "ghost" : "primary"} small" data-rsvp="${ev.id}">${ev.joined ? "Registered \u2713" : "Register"}</button>`}</div></article>`;
  }).join("") : `<div class="empty">No events scheduled.</div>`;
});
$("#eventList").addEventListener("click", safe(async (e) => {
  const { rsvp, edel } = e.target.dataset;
  if (rsvp) { await api(`/api/events/${rsvp}/rsvp`, { method: "POST" }); loadEvents(); }
  if (edel) { await api(`/api/events/${edel}`, { method: "DELETE" }); toast("Event deleted"); loadEvents(); }
}));
$("#eventForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  await api("/api/events", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
  e.target.reset(); toast("Event added"); loadEvents();
}));

// ---------- Students (admin) ----------
const loadUsers = safe(async () => {
  const list = await api("/api/users");
  $("#userList").innerHTML = list.length ? `<div class="panel"><div class="tbl-wrap"><table class="reg"><thead><tr><th>#</th><th>Name</th><th>Email</th><th class="num">Complaints</th><th></th></tr></thead><tbody>
    ${list.map((u, i) => `<tr><td>${i + 1}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td class="num">${u.complaints}</td><td class="num"><button class="btn danger" data-udel="${u.id}">Remove</button></td></tr>`).join("")}
    </tbody></table></div></div>` : `<div class="empty">No students have registered yet.</div>`;
});
$("#userList").addEventListener("click", safe(async (e) => {
  const id = e.target.dataset.udel;
  if (id && confirm("Remove this student?")) { await api(`/api/users/${id}`, { method: "DELETE" }); toast("Student removed"); loadUsers(); }
}));

// ---------- Community board ("Me too" upvotes) ----------
const loadCommunity = safe(async () => {
  const list = await api("/api/complaints/public");
  $("#communityList").innerHTML = list.length ? list.map((c) => `
    <article class="support"><div class="count"><b>${c.supportCount}</b><span>support</span></div>
      <div><h4>${esc(c.title)}</h4><div class="meta"><span class="badge pri-${c.priority}">${c.priority}</span> <span class="chip">${esc(c.category)}</span> <span class="chip">${esc(c.location)}</span> <span class="badge st-${cls(c.status)}">${esc(c.status)}</span> <span>${fmtDate(c.createdAt)}</span></div></div>
      <div class="actions">${c.mine ? `<span class="hint">Your complaint</span>` : `<button class="btn ${c.supported ? "on" : "primary"} small" data-support="${c.id}">${c.supported ? "Supported \u2713" : "Me too"}</button>`}</div></article>`).join("")
    : `<div class="empty">No public complaints right now. Tick &ldquo;Show on the community board&rdquo; when filing a complaint to share it.</div>`;
});
$("#communityList").addEventListener("click", safe(async (e) => {
  const id = e.target.dataset.support;
  if (id) { await api(`/api/complaints/${id}/support`, { method: "POST" }); loadCommunity(); }
}));

// ---------- Notifications: bell + live updates (Server-Sent Events) ----------
let live;
const refreshCurrent = () => { const v = [...$$(".view")].find((x) => !x.classList.contains("hidden")); if (v) loaders()[v.id.replace("view-", "")]?.(); };
const noteHtml = (n) => `<div class="n ${n.read === false ? "unread" : ""}"><b>${esc(n.title)}</b>${esc(n.message)}<br /><small>${new Date(n.createdAt).toLocaleString("en-IN")}</small></div>`;
function setBell(n) { const d = $("#bellCount"); d.textContent = n; d.classList.toggle("hidden", !n); }

const loadBell = safe(async () => {
  const list = await api("/api/notifications");
  setBell(list.filter((n) => !n.read).length);
  $("#bellMenu").innerHTML = `<h4>Notifications</h4>${list.length ? list.map(noteHtml).join("") : `<div class="none">No notifications yet.</div>`}`;
});
$("#bell").onclick = safe(async (e) => {
  e.stopPropagation();
  const menu = $("#bellMenu"); menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden")) { await api("/api/notifications/read", { method: "POST" }); setBell(0); }
});
document.addEventListener("click", (e) => { if (!e.target.closest(".bellwrap")) $("#bellMenu").classList.add("hidden"); });

function connectLive() {
  live?.close();
  live = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`); // one long-lived HTTP connection
  live.onmessage = (ev) => {
    const n = JSON.parse(ev.data);
    toast(`${n.title}: ${n.message}`);
    const menu = $("#bellMenu");
    if (!n.live) { // saved notification: add to the bell
      menu.querySelector(".none")?.remove();
      menu.querySelector("h4").insertAdjacentHTML("afterend", noteHtml({ ...n, read: false }));
      setBell(Number($("#bellCount").textContent || 0) + 1);
    }
    refreshCurrent(); // update whatever page is open, no manual refresh needed
  };
}

// ---------- Start ----------
if (token && user) showApp();

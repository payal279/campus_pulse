// ENTRY POINT: node server.js
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");

const { PORT } = require("./src/config");
const logger = require("./src/logger");
const db = require("./src/db");
const triage = require("./src/triage");
const requestLogger = require("./src/middleware/requestLogger");
const { notFound, errorHandler } = require("./src/middleware/errors");

const app = express();

// ORDER MATTERS: middleware runs top to bottom
app.use(express.json());                            // parses JSON body -> req.body
app.use(requestLogger);                             // logs each request
app.use(express.static(path.join(__dirname, "..", "frontend"))); // serves the separate frontend folder
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "admin.html")));

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/complaints", require("./src/routes/complaints"));
app.use("/api/notices", require("./src/routes/notices"));
app.use("/api/files", require("./src/routes/files"));
app.use("/api/events", require("./src/routes/events"));
app.use("/api/pulse", require("./src/routes/pulse"));
app.use("/api/users", require("./src/routes/users"));
app.use("/api/notifications", require("./src/routes/notifications"));
app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use(notFound);     // no route matched -> 404
app.use(errorHandler); // must be LAST

// Creates a default admin + welcome notice on the very first run
async function seed() {
  const users = await db.read("users");
  if (!users.some((u) => u.role === "admin")) {
    users.push({ id: db.newId(), name: "Campus Admin", email: "admin@campus.com", role: "admin", password: await bcrypt.hash("admin123", 10) });
    await db.write("users", users);
    logger.info("Seeded admin: admin@campus.com / admin123");
  }
  // department staff accounts (role "staff" sees only complaints assigned to their department)
  const staffAccounts = [["Electrical Team", "electrical@campus.com", "Electrical"], ["IT Team", "it@campus.com", "IT"], ["Hostel Team", "hostel@campus.com", "Hostel"], ["Maintenance Team", "maintenance@campus.com", "Maintenance"]];
  let added = false;
  for (const [name, email, dept] of staffAccounts) {
    if (!users.some((u) => u.email === email)) { users.push({ id: db.newId(), name, email, role: "staff", dept, password: await bcrypt.hash("staff123", 10) }); added = true; }
  }
  if (added) await db.write("users", users);
  const notices = await db.read("notices");
  if (!notices.length) {
    await db.write("notices", [{ id: db.newId(), title: "Welcome to CampusPulse", body: "Raise complaints, track their status and read official notices in one place.", createdAt: new Date().toISOString() }]);
  }
  if (!(await db.read("complaints")).length) { // demo data so the triage dashboard is not empty on first run
    const users = await db.read("users");
    let stu = users.find((u) => u.role === "student");
    if (!stu) { stu = { id: db.newId(), name: "Demo Student", email: "student@campus.com", role: "student", password: await bcrypt.hash("student123", 10) }; users.push(stu); await db.write("users", users); }
    const demo = [
      ["WiFi not working in Block C", "Internet is down in Block C since morning", "WiFi"], ["Block C internet very slow", "WiFi signal keeps dropping in Block C labs", "WiFi"],
      ["Block C wifi disconnecting", "Network disconnects every few minutes in Block C", "WiFi"], ["No internet in Block C classrooms", "Router seems dead, wifi not working", "WiFi"],
      ["Short circuit in Hostel 1", "Sparking and smoke from the switchboard in Hostel 1 room 204, fire risk", "Hostel"], ["Fire smell in Block A lab", "Burning smell and smoke near the Block A lab socket", "Classroom"],
      ["No water in Hostel 2", "No water on the second floor of Hostel 2 since last night", "Hostel"], ["Hostel 2 water problem", "No water in bathrooms of Hostel 2", "Hostel"],
      ["Projector broken in Block B", "Projector in Block B room 12 is not working", "Classroom"], ["Library AC not cooling", "The reading hall in the library is very hot", "Library"],
      ["Canteen hygiene issue", "Tables and food counters in the canteen are not cleaned", "Canteen"], ["Fan not working in Block D", "Ceiling fans are not working in Block D", "Classroom"]
    ].map(([title, description, category], i) => {
      const t = triage.analyze(`${title} ${description}`, category);
      return { id: db.newId(), userId: stu.id, userName: stu.name, title, description, category: t.category, priority: t.priority, location: t.location, triageSignals: t.signals,
        anonymous: i === 5, public: i < 8, supporters: [], dept: i % 3 === 0 ? triage.suggestDept({ title, description, category: t.category }) : null,
        status: i % 5 === 4 ? "Resolved" : "Pending", attachment: null, createdAt: new Date(Date.now() - (t.priority === "Urgent" ? 30 : 12 - i) * 3600000).toISOString() };
    });
    await db.write("complaints", demo);
  }
  if (!(await db.read("events")).length) {
    const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    await db.write("events", [
      { id: db.newId(), title: "Tech Fest Kickoff", venue: "Main Auditorium", date: inDays(5), description: "Hackathon, robo-race and open mic.", rsvps: [] },
      { id: db.newId(), title: "Placement Prep Workshop", venue: "Seminar Hall B", date: inDays(9), description: "Resume review and mock interviews.", rsvps: [] }
    ]);
  }
}

// Last-resort safety nets
process.on("unhandledRejection", (r) => logger.error(`Unhandled rejection: ${r}`));
process.on("uncaughtException", (e) => logger.error(`Uncaught exception: ${e.message}`));

seed().then(() => app.listen(PORT, () => logger.info(`CampusPulse running at http://localhost:${PORT}`)));

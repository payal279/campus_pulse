const express = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();
router.use(authenticate);

// shape each event for the logged-in user (hide the raw list of ids)
const present = (e, userId) => ({ id: e.id, title: e.title, venue: e.venue, date: e.date, description: e.description, going: e.rsvps.length, joined: e.rsvps.includes(userId) });

router.get("/", asyncHandler(async (req, res) => {
  const list = (await db.read("events")).sort((a, b) => a.date.localeCompare(b.date));
  res.json(list.map((e) => present(e, req.user.id)));
}));

router.post("/", authorize("admin"),
  validate((b) => {
    const e = [];
    if (!b.title || b.title.length < 4) e.push("Title must be at least 4 characters");
    if (!b.venue) e.push("Venue is required");
    if (!b.date || Number.isNaN(Date.parse(b.date))) e.push("Pick a valid date");
    return e;
  }),
  asyncHandler(async (req, res) => {
    const list = await db.read("events");
    const ev = { id: db.newId(), title: req.body.title, venue: req.body.venue, date: req.body.date, description: req.body.description || "", rsvps: [] };
    list.push(ev);
    await db.write("events", list);
    res.status(201).json(present(ev, req.user.id));
  }));

// POST /api/events/:id/rsvp  - toggles "I'm going"
router.post("/:id/rsvp", authorize("student"), asyncHandler(async (req, res) => {
  const list = await db.read("events");
  const ev = list.find((e) => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: "Event not found" });
  ev.rsvps = ev.rsvps.includes(req.user.id) ? ev.rsvps.filter((u) => u !== req.user.id) : [...ev.rsvps, req.user.id];
  await db.write("events", list);
  res.json(present(ev, req.user.id));
}));

router.delete("/:id", authorize("admin"), asyncHandler(async (req, res) => {
  const list = await db.read("events");
  if (!list.some((e) => e.id === req.params.id)) return res.status(404).json({ error: "Event not found" });
  await db.write("events", list.filter((e) => e.id !== req.params.id));
  res.json({ message: "Event deleted" });
}));

module.exports = router;

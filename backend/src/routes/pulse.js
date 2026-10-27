// "Campus Pulse" = daily mood vote (1 sad ... 5 happy). One vote per student per day.
const express = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();
router.use(authenticate);

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const average = (rows) => (rows.length ? Math.round((rows.reduce((s, r) => s + r.mood, 0) / rows.length) * 10) / 10 : 0);

router.get("/", asyncHandler(async (req, res) => {
  const all = await db.read("pulse");
  const today = all.filter((r) => r.day === dayKey());
  const week = [...Array(7)].map((_, i) => {
    const day = dayKey(new Date(Date.now() - (6 - i) * 86400000));
    const rows = all.filter((r) => r.day === day);
    return { day, avg: average(rows), count: rows.length };
  });
  const mine = today.find((r) => r.userId === req.user.id);
  res.json({ today: { avg: average(today), count: today.length }, mine: mine ? mine.mood : null, week });
}));

router.post("/", authorize("student"), asyncHandler(async (req, res) => {
  const mood = Number(req.body.mood);
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return res.status(400).json({ error: "Mood must be 1 to 5" });
  const all = await db.read("pulse");
  const rest = all.filter((r) => !(r.userId === req.user.id && r.day === dayKey())); // replace today's vote
  rest.push({ userId: req.user.id, mood, day: dayKey() });
  await db.write("pulse", rest);
  res.status(201).json({ message: "Pulse recorded" });
}));

module.exports = router;

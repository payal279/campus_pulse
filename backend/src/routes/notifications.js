const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const notifier = require("../notifier");
const { JWT_SECRET } = require("../config");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();

// GET /api/notifications/stream?token=...   (SSE). Browsers' EventSource cannot send headers, so the token goes in the URL.
router.get("/stream", (req, res) => {
  let user;
  try { user = jwt.verify(String(req.query.token || ""), JWT_SECRET); }
  catch { return res.status(401).end(); }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": connected\n\n");
  const remove = notifier.addClient({ res, userId: user.id, role: user.role, dept: user.dept });
  const beat = setInterval(() => res.write(": ping\n\n"), 25000); // keeps the connection alive
  req.on("close", () => { clearInterval(beat); remove(); });
});

// GET /api/notifications   (my latest saved notifications)
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const mine = (await db.read("notifications")).filter((n) => n.userId === req.user.id);
  res.json(mine.slice(-20).reverse());
}));

// POST /api/notifications/read   (mark all mine as read)
router.post("/read", authenticate, asyncHandler(async (req, res) => {
  const all = await db.read("notifications");
  all.forEach((n) => { if (n.userId === req.user.id) n.read = true; });
  await db.write("notifications", all);
  res.json({ message: "ok" });
}));

module.exports = router;

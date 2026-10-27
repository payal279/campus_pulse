const express = require("express");
const db = require("../db");
const bus = require("../events");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();

// Anyone logged in can read notices
router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    let list = await db.read("notices");
    if (req.query.q) list = list.filter((n) => (n.title + n.body).toLowerCase().includes(req.query.q.toLowerCase()));
    res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  })
);

// Only admins can post (middleware chain: authenticate -> authorize -> validate -> handler)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate((b) => {
    const e = [];
    if (!b.title || b.title.length < 4) e.push("Title must be at least 4 characters");
    if (!b.body || b.body.length < 10) e.push("Notice text must be at least 10 characters");
    return e;
  }),
  asyncHandler(async (req, res) => {
    const list = await db.read("notices");
    const notice = { id: db.newId(), title: req.body.title, body: req.body.body, createdAt: new Date().toISOString() };
    list.push(notice);
    await db.write("notices", list);
    bus.emit("notice:created", notice);
    res.status(201).json(notice);
  })
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const list = await db.read("notices");
    if (!list.some((n) => n.id === req.params.id)) return res.status(404).json({ error: "Notice not found" });
    await db.write("notices", list.filter((n) => n.id !== req.params.id));
    res.json({ message: "Notice deleted" });
  })
);

module.exports = router;

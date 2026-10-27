const express = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();
router.use(authenticate, authorize("admin")); // whole router is admin-only

router.get("/", asyncHandler(async (req, res) => {
  const [users, complaints] = await Promise.all([db.read("users"), db.read("complaints")]); // run both reads in parallel
  res.json(users.filter((u) => u.role === "student").map((u) => ({ id: u.id, name: u.name, email: u.email, complaints: complaints.filter((c) => c.userId === u.id && !c.anonymous).length })));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const users = await db.read("users");
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "admin") return res.status(403).json({ error: "Admin accounts cannot be removed" });
  await db.write("users", users.filter((u) => u.id !== target.id));
  res.json({ message: "Student removed" });
}));

module.exports = router;

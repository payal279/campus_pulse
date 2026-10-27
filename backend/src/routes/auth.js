const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const bus = require("../events");
const { JWT_SECRET, JWT_EXPIRES } = require("../config");
const { authenticate } = require("../middleware/auth");
const { validate, isEmail } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();

const makeToken = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, dept: u.dept }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
const publicUser = ({ id, name, email, role, dept }) => ({ id, name, email, role, dept });

// POST /api/auth/register
router.post(
  "/register",
  validate((b) => {
    const e = [];
    if (!b.name || b.name.length < 2) e.push("Name must be at least 2 characters");
    if (!isEmail(b.email)) e.push("Enter a valid email");
    if (!b.password || b.password.length < 6) e.push("Password must be at least 6 characters");
    return e;
  }),
  asyncHandler(async (req, res) => {
    const users = await db.read("users");
    const email = req.body.email.toLowerCase();
    if (users.some((u) => u.email === email)) return res.status(400).json({ error: "Email already registered" });

    // HASHING: never store plain passwords. bcrypt = one-way hash + random salt.
    const user = { id: db.newId(), name: req.body.name, email, role: "student", password: await bcrypt.hash(req.body.password, 10) };
    users.push(user);
    await db.write("users", users);
    bus.emit("user:registered", user);
    res.status(201).json({ token: makeToken(user), user: publicUser(user) }); // 201 = created
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const users = await db.read("users");
    const user = users.find((u) => u.email === String(req.body.email || "").toLowerCase());
    // same message for both cases so attackers can't learn which emails exist
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) {
      return res.status(401).json({ error: "Wrong email or password" });
    }
    res.json({ token: makeToken(user), user: publicUser(user) });
  })
);

// POST /api/auth/admin-login  - separate door for the admin portal (students are refused)
router.post(
  "/admin-login",
  asyncHandler(async (req, res) => {
    const users = await db.read("users");
    const user = users.find((u) => u.email === String(req.body.email || "").toLowerCase());
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) {
      return res.status(401).json({ error: "Wrong email or password" });
    }
    if (user.role !== "admin" && user.role !== "staff") return res.status(403).json({ error: "This portal is for admins and department staff only" });
    res.json({ token: makeToken(user), user: publicUser(user) });
  })
);

// GET /api/auth/me  (protected route)
router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

module.exports = router;

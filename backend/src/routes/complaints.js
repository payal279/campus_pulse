const express = require("express");
const path = require("path");
const multer = require("multer");
const mime = require("mime-types");
const db = require("../db");
const bus = require("../events");
const { authenticate, authorize } = require("../middleware/auth");
const { validate, clean } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errors");
const triage = require("../triage");

const router = express.Router();
const CATEGORIES = ["Hostel", "WiFi", "Classroom", "Library", "Canteen", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];

// MULTER = middleware for multipart/form-data (file upload)

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "uploads"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${require("crypto").randomUUID()}${ext}`);
    }
  }),

  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 1
  },

  fileFilter: (req, file, cb) => {
    const allowed = {
      ".png": ["image/png"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".pdf": ["application/pdf"]
    };

    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = allowed[ext];

    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
      return cb({
        status: 400,
        message: "Only PNG, JPG or PDF files with matching MIME types are allowed"
      });
    }

    cb(null, true);
  }
});


router.use(authenticate); // every route below needs a valid token

// Shapes a complaint for the person looking at it: adds SLA info, hides the author of anonymous complaints
function present(c, viewer, info = {}) {
  const priority = info.priority || c.priority;
  const out = { ...c, ...info, ...triage.slaInfo({ ...c, priority }), suggestedDept: triage.suggestDept(c),
    supportCount: (c.supporters || []).length, supported: (c.supporters || []).includes(viewer.id) };
  delete out.supporters;
  if (c.anonymous && c.userId !== viewer.id) { out.userName = "Anonymous"; delete out.userId; } // identity hidden from admins and staff
  return out;
}

// GET /api/complaints?status=Pending&q=wifi   (QUERY PARAMS for filtering)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const all = await db.read("complaints");
    const { byId } = triage.annotate(all); // priority + location + cluster for every complaint
    let list = all;
    if (req.user.role === "student") list = list.filter((c) => c.userId === req.user.id); // students see only their own
    else if (req.user.role === "staff") list = list.filter((c) => c.dept === req.user.dept); // staff see only their department
    const { status, q } = req.query;
    if (status) list = list.filter((c) => c.status === status);
    if (q) list = list.filter((c) => (c.title + c.description).toLowerCase().includes(q.toLowerCase()));
    list = list.map((c) => present(c, req.user, byId.get(c.id)));
    // overdue first, then most urgent, then newest
    res.json(list.sort((a, b) => (b.overdue - a.overdue) || triage.RANK[a.priority] - triage.RANK[b.priority] || b.createdAt.localeCompare(a.createdAt)));
  })
);

// ---- SMART TRIAGE ROUTES (define BEFORE "/:id" routes) ----
// POST /api/complaints/triage/preview : live suggestion while the student types
router.post("/triage/preview", (req, res) => {
  const text = `${req.body.title || ""} ${req.body.description || ""}`;
  res.json(triage.analyze(text, req.body.category));
});
// GET /api/complaints/triage/clusters : similar complaints merged into one issue
router.get("/triage/clusters", authorize("admin"), asyncHandler(async (req, res) => {
  const { groups } = triage.annotate(await db.read("complaints"));
  res.json(groups.map((g) => ({ id: g.id, location: g.location, category: g.category, title: g.title, priority: g.priority, count: g.items.length,
    open: g.items.filter((c) => c.status !== "Resolved").length })).sort((a, b) => b.count - a.count));
}));
// GET /api/complaints/triage/hotspots : heat score per campus location
router.get("/triage/hotspots", authorize("admin"), asyncHandler(async (req, res) => {
  const all = await db.read("complaints");
  res.json(triage.hotspots(all, triage.annotate(all).byId));
}));

// GET /api/complaints/stats  (admin only) - define BEFORE "/:id" routes
router.get(
  "/stats",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const list = await db.read("complaints");
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, list.filter((c) => c.status === s).length]));
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, list.filter((x) => x.category === c).length]));
    const overdue = list.filter((c) => triage.slaInfo(c).overdue).length;
    res.json({ total: list.length, overdue, byStatus, byCategory });
  })
);

// POST /api/complaints   (upload.single runs first and fills req.file + req.body)
router.post(
  "/",
  authorize("student"),
  upload.single("attachment"),
  validate((b) => {
    const e = [];
    if (!b.title || b.title.length < 4) e.push("Title must be at least 4 characters");
    if (!b.description || b.description.length < 10) e.push("Describe the problem in at least 10 characters");
    if (b.category !== "Auto" && !CATEGORIES.includes(b.category)) e.push("Choose a valid category");
    return e;
  }),
  asyncHandler(async (req, res) => {
    const list = await db.read("complaints");
    const t = triage.analyze(`${req.body.title} ${req.body.description}`, req.body.category); // auto category / priority / location
    const complaint = {
      id: db.newId(),
      userId: req.user.id,
      userName: req.user.name,
      title: req.body.title,
      description: req.body.description,
      category: t.category,
      priority: t.priority,
      location: triage.LOCATIONS.includes(req.body.location) ? req.body.location : t.location,
      triageSignals: t.signals,
      anonymous: ["on", "true"].includes(req.body.anonymous), // hide my name from staff
      public: ["on", "true"].includes(req.body.public),       // show on the community board
      supporters: [],
      dept: null,
      status: "Pending",
      attachment: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString()
    };
    list.push(complaint);
    await db.write("complaints", list);
    bus.emit("complaint:created", complaint);
    res.status(201).json(present(complaint, req.user));
  })
);

// PUT /api/complaints/:id/status   (:id is a ROUTE PARAM)
router.put(
  "/:id/status",
  authorize("admin", "staff"),
  asyncHandler(async (req, res) => {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
    const list = await db.read("complaints");
    const complaint = list.find((c) => c.id === req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found" });
    if (req.user.role === "staff" && complaint.dept !== req.user.dept) return res.status(403).json({ error: "This complaint is not assigned to your department" });
    complaint.status = req.body.status;
    if (req.body.status === "Resolved") complaint.resolvedAt = new Date().toISOString();
    if (req.body.remark !== undefined) complaint.remark = clean(req.body.remark); // admin reply shown to the student
    await db.write("complaints", list);
    bus.emit("complaint:updated", complaint);
    res.json(present(complaint, req.user));
  })
);

// PUT /api/complaints/:id/assign   (admin gives the complaint to a department)
router.put(
  "/:id/assign",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const dept = req.body.dept || null;
    if (dept && !triage.DEPARTMENTS.includes(dept)) return res.status(400).json({ error: "Unknown department" });
    const list = await db.read("complaints");
    const complaint = list.find((c) => c.id === req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found" });
    complaint.dept = dept;
    await db.write("complaints", list);
    if (dept) bus.emit("complaint:assigned", complaint);
    res.json(present(complaint, req.user));
  })
);

// GET /api/complaints/public   (community board: public complaints, no author names)
router.get(
  "/public",
  authorize("student"),
  asyncHandler(async (req, res) => {
    const list = (await db.read("complaints")).filter((c) => c.public && c.status !== "Resolved");
    res.json(list.map((c) => ({ id: c.id, title: c.title, category: c.category, location: c.location, priority: c.priority, status: c.status,
      createdAt: c.createdAt, mine: c.userId === req.user.id, supportCount: (c.supporters || []).length, supported: (c.supporters || []).includes(req.user.id) }))
      .sort((a, b) => b.supportCount - a.supportCount || b.createdAt.localeCompare(a.createdAt)));
  })
);

// POST /api/complaints/:id/support   ("Me too" toggle)
router.post(
  "/:id/support",
  authorize("student"),
  asyncHandler(async (req, res) => {
    const list = await db.read("complaints");
    const c = list.find((x) => x.id === req.params.id && x.public);
    if (!c) return res.status(404).json({ error: "Complaint not found on the community board" });
    if (c.userId === req.user.id) return res.status(400).json({ error: "You cannot support your own complaint" });
    c.supporters = c.supporters || [];
    c.supporters = c.supporters.includes(req.user.id) ? c.supporters.filter((u) => u !== req.user.id) : [...c.supporters, req.user.id];
    await db.write("complaints", list);
    res.json({ supportCount: c.supporters.length, supported: c.supporters.includes(req.user.id) });
  })
);

// DELETE /api/complaints/:id   (admin, or the owner while still Pending)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const list = await db.read("complaints");
    const c = list.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Complaint not found" });
    const isOwner = c.userId === req.user.id && c.status === "Pending";
    if (req.user.role !== "admin" && !isOwner) return res.status(403).json({ error: "You cannot delete this complaint" });
    await db.write("complaints", list.filter((x) => x.id !== c.id));
    res.json({ message: "Complaint deleted" });
  })
);

module.exports = router;

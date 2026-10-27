
const express = require("express");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const db = require("../db");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errors");

const router = express.Router();
const UPLOADS = path.join(__dirname, "..", "..", "uploads");

// GET /api/files/:name
// Authenticate the user, authorize access to the complaint,
// then stream the attachment in chunks.
router.get(
  "/:name",
  authenticate,
  asyncHandler(async (req, res, next) => {
    const safeName = path.basename(req.params.name);

    // Find the complaint that owns this attachment.
    const complaints = await db.read("complaints");
    const complaint = complaints.find(
      (c) => c.attachment === safeName
    );

    if (!complaint) {
      return res.status(404).json({ error: "File not found" });
    }

    // Authorization: who may access this complaint's file?
    const user = req.user;
    const isAdmin = user.role === "admin";
    const isOwner =
      user.role === "student" &&
      complaint.userId === user.id;
    const isAssignedStaff =
      user.role === "staff" &&
      complaint.dept === user.dept;

    if (!isAdmin && !isOwner && !isAssignedStaff) {
      return res.status(403).json({
        error: "You do not have permission to access this file"
      });
    }

    const filePath = path.join(UPLOADS, safeName);

    const contentType = mime.lookup(filePath);
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "application/pdf"
    ];

    if (!allowedTypes.includes(contentType)) {
      return res.status(415).json({
        error: "Unsupported file type"
      });
    }

    // Stream the file instead of loading it entirely into RAM.
    const stream = fs.createReadStream(filePath);

    stream.on("error", (err) => {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" });
      }
      next(err);
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");

    stream.pipe(res);
  })
);

module.exports = router;

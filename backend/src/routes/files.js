const express = require("express");
const fs = require("fs");
const path = require("path");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const UPLOADS = path.join(__dirname, "..", "..", "uploads");

// GET /api/files/:name - sends a file using a STREAM (chunks, low memory)
router.get("/:name", authenticate, (req, res, next) => {
  const safeName = path.basename(req.params.name); // blocks "../../secret" path tricks
  const filePath = path.join(UPLOADS, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  const stream = fs.createReadStream(filePath);
  stream.on("error", next);
  stream.pipe(res); // pipe: source stream -> response stream
});

module.exports = router;

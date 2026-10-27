const express = require("express");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const UPLOADS = path.join(__dirname, "..", "..", "uploads");

// GET /api/files/:name - sends a file using a STREAM (chunks, low memory)

router.get("/:name", authenticate, (req, res, next) => {
  const safeName = path.basename(req.params.name);
  const filePath = path.join(UPLOADS, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const contentType = mime.lookup(filePath);

  if (!contentType) {
    return res.status(415).json({ error: "Unsupported file type" });
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");

  const previewable = [
    "image/png",
    "image/jpeg",
    "application/pdf"
  ].includes(contentType);

  res.setHeader(
    "Content-Disposition",
    previewable ? "inline" : "attachment"
  );

  const stream = fs.createReadStream(filePath);
  stream.on("error", next);
  stream.pipe(res);
});


module.exports = router;

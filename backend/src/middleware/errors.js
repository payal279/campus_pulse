
const multer = require("multer");
const logger = require("../logger");

// 404 handler: no route matched
const notFound = (req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
};

// Express 4 async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Centralized error handler
// Keep this middleware LAST in server.js.
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Multer errors: upload limits and file count
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";

    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge
        ? "File size exceeds the 2 MB limit"
        : `Upload error: ${err.message}`
    });
  }

  // Invalid JSON sent by the client
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    Object.prototype.hasOwnProperty.call(err, "body")
  ) {
    return res.status(400).json({
      error: "Invalid JSON request body"
    });
  }

  // Expected client errors
  const status = Number(err.status || err.statusCode);

  if (status >= 400 && status < 500) {
    return res.status(status).json({
      error: err.message || "Invalid request"
    });
  }

  // Unexpected server errors: log details privately
  logger.error(err.stack || err.message || String(err));

  return res.status(500).json({
    error: "Something went wrong on the server"
  });
};

module.exports = {
  notFound,
  asyncHandler,
  errorHandler
};

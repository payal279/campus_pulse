// Special middleware: 4 parameters (err, req, res, next) = ERROR HANDLER.
// Any error passed to next(err) or thrown in a route lands here.
const multer = require("multer");
const logger = require("../logger");

const notFound = (req, res) => res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });

// Express 4 does not catch errors in async functions by itself. This wrapper does.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Upload error: ${err.message}` });
  if (err.status) return res.status(err.status).json({ error: err.message });
  logger.error(err.stack || err.message);
  res.status(500).json({ error: "Something went wrong on the server" }); // 500 = server error
};

module.exports = { notFound, asyncHandler, errorHandler };

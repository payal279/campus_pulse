// MIDDLEWARE = function(req, res, next). Runs between request and response.
// This one logs every request with its status code and time taken.
const logger = require("../logger");

module.exports = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next(); // without next() the request would hang forever
};

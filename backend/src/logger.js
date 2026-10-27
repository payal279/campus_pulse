// Logging = recording what happened. Writes to console AND logs/app.log.
// createWriteStream = STREAM: data is written piece by piece, not all in memory.
const fs = require("fs");
const path = require("path");

fs.mkdirSync(path.join(__dirname, "..", "logs"), { recursive: true });
const stream = fs.createWriteStream(path.join(__dirname, "..", "logs", "app.log"), { flags: "a" });

function log(level, message) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  console.log(line);
  stream.write(line + "\n");
}

module.exports = {
  info: (m) => log("info", m),
  warn: (m) => log("warn", m),
  error: (m) => log("error", m)
};

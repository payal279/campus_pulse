// Tiny "database": each collection is a JSON file in /data.
// Uses ASYNC fs (fs.promises) so the event loop is never blocked.
const fs = require("fs").promises;
const path = require("path");

const DIR = path.join(__dirname, "..", "data");
const fileOf = (name) => path.join(DIR, `${name}.json`);

async function read(name) {
  try {
    return JSON.parse(await fs.readFile(fileOf(name), "utf8")); // JSON text -> object
  } catch (err) {
    if (err.code === "ENOENT") return []; // file not created yet
    throw err;
  }
}


async function write(name, data) {
  await fs.mkdir(DIR, { recursive: true });

  const target = fileOf(name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;

  try {
    // First write the complete data to a temporary file.
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(temp, content, { flag: "wx" });

    // Replace the target only after the temporary file is ready.
    await fs.rename(temp, target);
  } catch (err) {
    // Clean up a temporary file if the write or rename fails.
    try {
      await fs.unlink(temp);
    } catch {
      // Ignore cleanup errors; preserve the original error.
    }

    throw err;
  }
}


const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

module.exports = { read, write, newId };

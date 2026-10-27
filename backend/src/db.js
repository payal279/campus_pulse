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
  await fs.writeFile(fileOf(name), JSON.stringify(data, null, 2)); // object -> JSON text
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

module.exports = { read, write, newId };

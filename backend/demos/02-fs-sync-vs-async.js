// Run: node demos/02-fs-sync-vs-async.js
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "sample.json");

fs.writeFileSync(file, JSON.stringify({ name: "Campus", year: 2026 })); // JSON.stringify: object -> text

const text = fs.readFileSync(file, "utf8");   // SYNC: blocks everything until done
console.log("sync:", JSON.parse(text));         // JSON.parse: text -> object

fs.readFile(file, "utf8", (err, data) => {    // ASYNC callback: Node keeps working meanwhile
  if (err) return console.error(err.message);
  console.log("async:", JSON.parse(data));
});
console.log("this prints BEFORE the async result");

fs.promises.readFile("missing.txt").catch((e) => console.log("error handled:", e.code)); // ENOENT

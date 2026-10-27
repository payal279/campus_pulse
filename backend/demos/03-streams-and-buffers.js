// Run: node demos/03-streams-and-buffers.js
const fs = require("fs");
const path = require("path");

// BUFFER = raw binary data held in memory
const buf = Buffer.from("Hello");
console.log(buf, buf.toString(), buf.length); // <Buffer 48 65 6c 6c 6f> Hello 5

// STREAM = process data in small chunks (good for big files)
const src = path.join(__dirname, "big.txt");
const dest = path.join(__dirname, "copy.txt");
fs.writeFileSync(src, "line of text\n".repeat(200000));

const reader = fs.createReadStream(src, { highWaterMark: 64 * 1024 }); // 64 KB chunks
let chunks = 0;
reader.on("data", () => chunks++);
reader.on("end", () => console.log("read finished, chunks:", chunks));
reader.pipe(fs.createWriteStream(dest)).on("finish", () => console.log("copied with pipe()"));

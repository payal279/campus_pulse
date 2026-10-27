// Run: node demos/06-es-modules.mjs   (.mjs = ES Modules)
// CommonJS: const x = require("x");  module.exports = ...   (loads synchronously, Node default)
// ES Modules: import x from "x";     export ...             (static, async, browser standard)
import path from "path";
import { readFile } from "fs/promises";
export const add = (a, b) => a + b;
console.log(path.basename("/a/b/file.txt"), add(2, 3));
console.log(typeof (await readFile(new URL(import.meta.url))), "(top-level await works in ESM)");

// Run: node demos/07-process-and-globals.js
console.log("file:", __filename);
console.log("folder:", __dirname);
console.log("args:", process.argv.slice(2));       // try: node demos/07-process-and-globals.js hello
console.log("node:", process.version, "platform:", process.platform);
console.log("PORT env:", process.env.PORT || "(not set)");
process.on("exit", (code) => console.log("exiting with code", code));

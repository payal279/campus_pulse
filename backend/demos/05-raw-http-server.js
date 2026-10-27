// Run: node demos/05-raw-http-server.js  then open http://localhost:4000 and /api/time
// This is what Express makes easier: manual routing, headers and status codes.
const http = require("http");

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<h1>Plain Node server</h1>");
  }
  if (req.method === "GET" && req.url === "/api/time") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ time: new Date().toISOString() }));
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}).listen(4000, () => console.log("http://localhost:4000"));

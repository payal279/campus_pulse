// REAL-TIME NOTIFICATIONS using Server-Sent Events (SSE).
// SSE = the browser opens ONE long-lived HTTP connection and the server keeps writing events into it.
// (Socket.io does the same job with extra features; SSE needs no extra package.)
const db = require("./db");

const clients = new Set(); // every open browser connection: { res, userId, role, dept }

function addClient(client) {
  clients.add(client);
  return () => clients.delete(client); // call this to remove it when the browser disconnects
}

const push = (client, payload) => client.res.write(`data: ${JSON.stringify(payload)}\n\n`); // SSE wire format

// Save a notification for one user (shows in the bell later) AND push it live if they are online
async function notifyUser(userId, title, message) {
  const n = { id: db.newId(), userId, title, message, read: false, createdAt: new Date().toISOString() };
  const all = await db.read("notifications");
  all.push(n);
  await db.write("notifications", all.slice(-500));
  clients.forEach((c) => c.userId === userId && push(c, n));
}

// Live-only message for everyone with a role (optionally filtered, e.g. one department)
function notifyRole(role, title, message, filter = () => true) {
  const n = { id: db.newId(), title, message, createdAt: new Date().toISOString(), live: true };
  clients.forEach((c) => c.role === role && filter(c) && push(c, n));
}

module.exports = { addClient, notifyUser, notifyRole, clients };

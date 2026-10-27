// EventEmitter = Node's publish/subscribe. emit() announces, on() listens.
// Routes just announce what happened; the listeners below do logging, live notifications and email.
const EventEmitter = require("events");
const logger = require("./logger");
const db = require("./db");
const notifier = require("./notifier");
const mailer = require("./mailer");

const bus = new EventEmitter();
const guard = (fn) => (...args) => Promise.resolve(fn(...args)).catch((e) => logger.error(`Event handler failed: ${e.message}`)); // a failing listener must never crash the server

bus.on("user:registered", (user) => logger.info(`New user registered: ${user.email}`));

bus.on("complaint:created", guard((c) => {
  logger.info(`New complaint "${c.title}" by ${c.anonymous ? "Anonymous" : c.userName}`);
  notifier.notifyRole("admin", "New complaint", `${c.priority}: ${c.title}`);
}));

bus.on("complaint:updated", guard(async (c) => {
  logger.info(`Complaint ${c.id} is now ${c.status}`);
  await notifier.notifyUser(c.userId, `Complaint ${c.status}`, `"${c.title}" is now ${c.status}.${c.remark ? ` Reply: ${c.remark}` : ""}`);
  if (c.status === "Resolved") { // email the student
    const owner = (await db.read("users")).find((u) => u.id === c.userId);
    if (owner) await mailer.sendMail(owner.email, "Your grievance has been resolved",
      `Hello ${owner.name},\n\nYour complaint "${c.title}" has been marked Resolved.${c.remark ? `\n\nReply from the grievance cell: ${c.remark}` : ""}\n\nCampusPulse Grievance Cell`);
  }
}));

bus.on("complaint:assigned", guard((c) => {
  logger.info(`Complaint ${c.id} assigned to ${c.dept}`);
  notifier.notifyRole("staff", "New assignment", `${c.priority}: ${c.title}`, (client) => client.dept === c.dept);
}));

bus.on("notice:created", guard((n) => notifier.notifyRole("student", "New notice", n.title)));

module.exports = bus;

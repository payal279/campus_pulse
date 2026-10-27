// Run: node demos/04-event-emitter.js
const EventEmitter = require("events");
class Shop extends EventEmitter {}
const shop = new Shop();

shop.on("order", (item, qty) => console.log(`Order: ${qty} x ${item}`));
shop.once("open", () => console.log("Shop opened (once() fires only one time)"));
shop.on("error", (e) => console.log("Handled:", e.message)); // without this, emit('error') crashes Node

shop.emit("open"); shop.emit("open");
shop.emit("order", "tea", 2);
shop.emit("error", new Error("out of milk"));

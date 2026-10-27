// Run: node demos/01-event-loop-and-async.js
// Q: Order of output? A: 1, 4, 3 (promise/microtask), 2 (timer). Sync first, then microtasks, then timers.
console.log("1. start");
setTimeout(() => console.log("2. timer (macrotask)"), 0);
Promise.resolve().then(() => console.log("3. promise (microtask)"));
console.log("4. end of sync code");

// Same job three ways: callback -> promise -> async/await
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
wait(100).then(() => console.log("promise .then done"));
(async () => { await wait(200); console.log("async/await done"); })();

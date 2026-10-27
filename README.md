# CampusPulse (BEE-II CE-1)

A campus app where students raise complaints, read notices, join events and share the daily campus mood. A separate admin portal manages everything.

## New in v2 (6 extra features)
| Feature | How it works | Where |
|---|---|---|
| **SLA timer / Overdue** | Each priority has a deadline (Urgent 24 h, High 48 h, Medium 72 h, Low 120 h). Open complaints past the deadline get a red blinking OVERDUE tag, sort to the top, and are counted on the dashboard. | `backend/src/triage.js` (`slaInfo`), `routes/complaints.js` |
| **Anonymous complaint** | Student ticks "Submit anonymously". The API hides the name/userId from admin and staff; only the owner sees it. | `present()` in `routes/complaints.js` |
| **Real-time notifications** | Server-Sent Events: the browser keeps one HTTP connection open and the server pushes events. Bell icon + toast, no refresh. | `src/notifier.js`, `routes/notifications.js`, `connectLive()` in `app.js` |
| **Email notification** | Nodemailer on "Resolved". Without SMTP settings the email is simulated (log + `data/outbox.json`). | `src/mailer.js`, `src/events.js` |
| **Me too / upvote** | Students can make a complaint public (name never shown); others press "Me too" (toggle). | `/api/complaints/public`, `/:id/support` |
| **Department assignment** | Admin assigns a complaint to Electrical / IT / Hostel / Maintenance / Academic (a team is suggested automatically). A staff login sees and updates only its own department. | `PUT /:id/assign`, role `staff` |

**New logins (admin portal page):** `it@campus.com`, `electrical@campus.com`, `hostel@campus.com`, `maintenance@campus.com`, all with password `staff123`.
To send real email set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` before `npm start`.
If you already ran an older version, delete `backend/data/complaints.json` once to get fresh demo data with an overdue example.

**Extra viva answers**
- *SSE vs WebSocket/Socket.io?* SSE is one-way (server to browser) over plain HTTP, simple and enough for notifications. WebSockets are two-way.
- *Why is an anonymous complaint still linked to a user?* So the owner can see it and get notified. The API removes the identity for everyone else.
- *How is role-based access done for staff?* JWT carries `role` and `dept`. `authorize("admin","staff")` guards the route and the handler checks `complaint.dept === req.user.dept`.
- *What if email fails?* `sendMail` catches errors and logs them, so a mail problem never breaks the request.
- *Why event listeners for notifications?* Routes only `emit`; `events.js` listens and decides what to do (log, notify, email). That keeps routes small.

## Folders
```
campuspulse/
  backend/    Node + Express REST API  (server.js, src/, data/, uploads/, demos/)
  frontend/   HTML + CSS + JS          (index.html = student, admin.html = admin portal)
```
The backend also serves the frontend folder, so you run ONE command.

## Run
1. Install Node.js LTS (nodejs.org)
2. In the `campuspulse` folder terminal:  `npm run setup`   (installs backend packages, first time only)
3. `npm start`
4. Student portal: http://localhost:3000     Admin portal: http://localhost:3000/admin.html

**UI:** official institutional look (header, menu bar, forms, registers/tables), light/dark theme button. Change the college name in `frontend/js/config.js`.

Admin: `admin@campus.com` / `admin123`. Students: "Create account".
Tip: use two browser windows (student + admin) to demo live. Both can stay logged in together.
Backend extras (inside `backend/`): `npm run dev` (auto restart), `npm run lint` (ESLint).

## Features
**Student:** register/login, raise complaint with photo/PDF, search + filter, see admin replies, daily mood vote (Pulse), notice board, RSVP to events.
**Admin portal:** admin-only login, overview with stats and 7-day mood chart, change status + reply to students, pin/remove notices, add/remove events, manage students.
**UI:** light/dark theme button, 3D rotating cube, 3D press buttons, cards that tilt with the mouse.

## Syllabus -> where to show it
| Syllabus topic | Where |
|---|---|
| HTML, CSS, DOM, events | `frontend/*.html`, `css/style.css`, `js/app.js` |
| JS fundamentals, ES6, Promises, async/await, Promise.all, Fetch, JSON | `frontend/js/app.js` (`api()`, `loadHome`), `backend/demos/01` |
| Git/GitHub | `git init`, `git add .`, `git commit -m "campuspulse"`, `git push` |
| NPM, package.json, dependencies vs devDependencies | `backend/package.json` |
| Node setup, REPL, globals, process | `backend/demos/07`, type `node` for REPL |
| Event loop | `backend/demos/01` |
| CommonJS vs ES Modules | project = CommonJS, `demos/06` = ESM |
| fs, path, JSON handling | `backend/src/db.js`, `demos/02` |
| Streams, Buffers | `src/logger.js`, `src/routes/files.js`, `demos/03` |
| HTTP module | `demos/05` |
| EventEmitter | `src/events.js`, `demos/04` |
| Error handling | `src/middleware/errors.js`, `process.on` in `server.js` |
| Express, routing, middleware | `server.js`, `src/routes/*` |
| params / query / body | `/:id`, `?q=&status=`, JSON body |
| REST CRUD, status codes | `routes/complaints.js`, `events.js`, `notices.js` |
| Validation, sanitization | `middleware/validate.js`, `esc()` in `app.js` |
| bcrypt, JWT, protected routes, roles | `routes/auth.js` (login + admin-login), `middleware/auth.js` |
| File upload (Multer) | `routes/complaints.js` |
| Postman | API list below |
| ESLint, logging | `backend/eslint.config.js`, `src/logger.js` (logs/app.log) |
| Bootstrap/Tailwind | custom CSS here. Bootstrap = ready-made classes, we wrote our own |

## API list (test in Postman, header `Authorization: Bearer <token>`)
| Method | URL | Who |
|---|---|---|
| POST | /api/auth/register, /login | public |
| POST | /api/auth/admin-login | admin only (students get 403) |
| GET | /api/complaints?status=&q= | students: own, admin: all |
| POST | /api/complaints (form-data) | student |
| PUT | /api/complaints/:id/status  `{status, remark}` | admin |
| DELETE | /api/complaints/:id | admin, or owner while Pending |
| GET | /api/complaints/stats | admin |
| GET, POST, DELETE | /api/notices | read all, write admin |
| GET, POST, DELETE | /api/events | read all, write admin |
| POST | /api/events/:id/rsvp | student (toggle) |
| GET, POST | /api/pulse | read all, vote student |
| GET, DELETE | /api/users | admin |
| GET | /api/files/:name | logged in (streamed) |

## Request flow (say this in viva)
Browser `fetch` -> Express -> `express.json()` -> requestLogger -> router -> `authenticate` (JWT) -> `authorize` (role) -> `validate` -> handler (fs read/write JSON) -> `res.json()`. Errors -> `errorHandler`.

## Viva Q&A
1. **Why Express over http module?** Routing, body parsing, middleware and static files built in. `demos/05` shows the manual way.
2. **Middleware?** `(req, res, next)` function between request and response. No `next()` = request hangs.
3. **Why order matters?** Runs top to bottom. `express.json()` before routes, `errorHandler` last.
4. **401 vs 403?** 401 not logged in. 403 logged in but not allowed (student on admin route).
5. **How does JWT work?** Server signs `{id, role}` with a secret at login. Client sends it each request. Server verifies the signature, so no session store.
6. **Why separate admin-login?** It rejects students at the door (403), and the admin page uses its own storage keys.
7. **Why hash passwords?** A leaked database would expose plain passwords. bcrypt is one-way and salted.
8. **readFile vs readFileSync?** Sync blocks the event loop, async lets Node serve others meanwhile.
9. **Event loop?** One JS thread; async work is handed off and callbacks return when ready. See `demos/01` output order.
10. **Streams vs buffers?** Buffer = bytes in memory. Stream = chunks, so big files do not fill RAM (file download, log writing).
11. **params vs query vs body?** `/complaints/5` params, `?status=Pending` query, POST payload body.
12. **Why `asyncHandler`?** Express 4 does not catch rejected promises in async routes; the wrapper sends them to `errorHandler`.
13. **Why `Promise.all` in `loadHome`?** Three independent requests run together, so the page loads faster.
14. **Why sanitize?** Removes `<` `>` on the server and `esc()` on the client to stop XSS.
15. **CommonJS vs ESM?** `require/module.exports` vs `import/export`.
16. **Why JSON files, not MongoDB?** CE-1 covers up to Express; `db.js` shows fs + JSON. MongoDB (topic 5) would replace `db.js`.
17. **Why separate frontend and backend folders?** Separation of concerns: UI and API are independent. Backend serves the frontend only for convenience.

## Live tasks they might give
- Add `GET /api/hello` returning `{ message: "hi" }` in `server.js`
- Add a new complaint category (`CATEGORIES` in `routes/complaints.js` + the dropdown in HTML)
- Write a middleware that blocks requests without an `x-api-key` header
- Read a JSON file with `fs` and print one field
- Change a theme colour in `:root` of `style.css`

## Smart Complaint Triage (added)
- `backend/src/triage.js`: keyword scoring gives priority (fire / short circuit = Urgent), category and location; token-overlap clustering merges similar complaints; hotspot score per location.
- Routes: `POST /api/complaints/triage/preview`, `GET /api/complaints/triage/clusters`, `GET /api/complaints/triage/hotspots` (admin).
- Admin home: 3D hotspot map, grouped issues, Chart.js priority chart. Demo data seeds on first run (student@campus.com / student123).

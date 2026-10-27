// EMAIL with Nodemailer. If no SMTP settings are given, emails are SIMULATED:
// they are printed in the log and saved in data/outbox.json, so the demo works offline.
// To send real mail set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and MAIL_FROM) before npm start.
const db = require("./db");
const logger = require("./logger");

let transporter = null;
if (process.env.SMTP_HOST) {
  try {
    transporter = require("nodemailer").createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } catch {
    logger.warn("nodemailer is not installed (run npm install). Emails will be simulated.");
  }
}

async function sendMail(to, subject, text) { // never throws: a mail problem must not break the request
  try {
    if (transporter) {
      await transporter.sendMail({ from: process.env.MAIL_FROM || "CampusPulse <no-reply@campuspulse.local>", to, subject, text });
      logger.info(`Email sent to ${to}: ${subject}`);
      return;
    }
    const box = await db.read("outbox");
    box.push({ to, subject, text, at: new Date().toISOString() });
    await db.write("outbox", box.slice(-100));
    logger.info(`[SIMULATED EMAIL] to ${to}: ${subject}`);
  } catch (err) {
    logger.error(`Email failed: ${err.message}`);
  }
}

module.exports = { sendMail };

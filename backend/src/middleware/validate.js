// SANITIZATION = clean the input.  VALIDATION = check the input is acceptable.
const clean = (value) => String(value ?? "").replace(/[<>]/g, "").trim(); // strips tags -> blocks basic XSS

const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Factory: validate(rules) returns a middleware. rules(body) returns a list of error strings.
const validate = (rules) => (req, res, next) => {
  for (const key of Object.keys(req.body || {})) {
    if (typeof req.body[key] === "string") req.body[key] = clean(req.body[key]);
  }
  const errors = rules(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(", ") }); // 400 = bad request
  next();
};

module.exports = { validate, isEmail, clean };

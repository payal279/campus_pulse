// AUTHENTICATION = "who are you?"  AUTHORIZATION = "are you allowed?"
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

// Reads "Authorization: Bearer <token>", verifies it, puts the user on req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in first" }); // 401 = not logged in
  try {
    req.user = jwt.verify(token, JWT_SECRET); // throws if fake or expired
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again" });
  }
}

// Role-based access: authorize("admin") lets only admins through
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "You do not have permission" }); // 403 = logged in, not allowed
  }
  next();
};

module.exports = { authenticate, authorize };

// Central settings. process.env lets you override them without changing code.

require("dotenv").config();

// Central application settings
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from environment variables");
}

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES: "2h"
};

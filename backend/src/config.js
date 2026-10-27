// Central settings. process.env lets you override them without changing code.
module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || "campus-secret-change-me",
  JWT_EXPIRES: "2h"
};

// ESLint = tool that finds mistakes + style problems in code. Run: npm run lint
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs" },
    rules: { "no-unused-vars": "warn", "no-undef": "off", eqeqeq: "warn", "prefer-const": "warn" }
  }
];

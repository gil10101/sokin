module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    // Code Style
    "quotes": ["error", "double"],
    "indent": ["error", 2],
    "semi": ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],

    // Best Practices
    "no-console": "warn", // Allow console in Firebase Functions for logging
    "no-debugger": "error",
    "no-unused-vars": "off", // Let TypeScript handle this
    "prefer-const": "error",
    "no-var": "error",

    // TypeScript Specific
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off", // Firebase Functions are often callbacks
    "@typescript-eslint/explicit-module-boundary-types": "off", // Common in Firebase Functions
    "@typescript-eslint/no-inferrable-types": "off", // Allow explicit types for clarity
    "@typescript-eslint/prefer-optional-chain": "error",

    // Firebase Functions Specific
    "@typescript-eslint/require-await": "off", // Firebase Functions can return promises
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",

    // Security
    "@typescript-eslint/no-implied-eval": "error",
    "@typescript-eslint/no-dynamic-delete": "warn",
  },
};

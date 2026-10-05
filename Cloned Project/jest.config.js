/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: [
    "<rootDir>/server/bat246/__tests__",
    "<rootDir>/server/utils/__tests__",
    "<rootDir>/server/services/__tests__",
    "<rootDir>/server/routes/__tests__",
  ],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    // strictNullChecks, despite `strict: false`: mongoose's model typings
    // collapse into an uncallable union without it, so any test that imports a
    // module touching a model fails to compile rather than fails an assertion.
    "^.+\\.ts$": ["ts-jest", { tsconfig: { strict: false, strictNullChecks: true } }],
  },
  clearMocks: true,
};

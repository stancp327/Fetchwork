/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir:         '.',
  testTimeout:     20000,
  forceExit:       true,
  detectOpenHandles: true,
  verbose:         true,

  // Two suites: unit (model mocks, fast) and integration (real in-memory MongoDB)
  projects: [
    {
      displayName: 'unit',
      // Includes both new unit/ subfolder AND legacy root-level test files
      testMatch:   [
        '<rootDir>/__tests__/unit/**/*.test.js',
        '<rootDir>/__tests__/*.test.js',  // existing auth.test.js, jobs.test.js etc.
      ],
      testEnvironment: 'node',
    },
    {
      displayName:  'integration',
      testMatch:    ['<rootDir>/__tests__/integration/**/*.test.js'],
      testEnvironment: 'node',
      globalSetup:    '<rootDir>/__tests__/setup/globalSetup.js',
      globalTeardown: '<rootDir>/__tests__/setup/globalTeardown.js',
    },
  ],

  // Coverage (run with --coverage flag)
  collectCoverageFrom: [
    'routes/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**',
    '!index.js',
    '!config/**',
    '!crons/**',   // covered indirectly
  ],
  coverageThresholds: {
    global:                      { branches: 55, functions: 65, lines: 65, statements: 65 },
    '<rootDir>/routes/payments.js': { lines: 85 },
    '<rootDir>/routes/jobs.js':     { lines: 75 },
    '<rootDir>/routes/disputes.js': { lines: 75 },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};

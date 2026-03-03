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
      // Regex avoids Windows path-escape issues from absolute rootDir strings
      testRegex: ['/__tests__/(?!integration/).*\\.test\\.js$'],
      testEnvironment: 'node',
    },
    {
      displayName:  'integration',
      testRegex:    ['/__tests__/integration/.*\\.test\\.js$'],
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
  coverageThreshold: {
    global:                      { branches: 55, functions: 65, lines: 65, statements: 65 },
    '<rootDir>/routes/payments.js': { lines: 85 },
    '<rootDir>/routes/jobs.js':     { lines: 75 },
    '<rootDir>/routes/disputes.js': { lines: 75 },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};

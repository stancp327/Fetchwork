module.exports = {
  // Server unit tests (no DB needed)
  projects: [
    {
      displayName: 'server-unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/server/__tests__/*.test.js',
      ],
      // Exclude setup files and integration tests
      testPathIgnorePatterns: [
        '/node_modules/',
        '/server/__tests__/setup/',
        '/server/__tests__/integration/',
        '/e2e/',
      ],
    },
    {
      displayName: 'server-integration',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/server/__tests__/integration/*.test.js',
      ],
      globalSetup: '<rootDir>/server/__tests__/setup/globalSetup.js',
      globalTeardown: '<rootDir>/server/__tests__/setup/globalTeardown.js',
      testPathIgnorePatterns: ['/node_modules/'],
      transformIgnorePatterns: [
        '/node_modules/(?!(@faker-js|mongodb-memory-server)/)',
      ],
    },
    // Client tests run via react-scripts (CRA's own Jest config)
    // Run separately: cd client && npx react-scripts test
  ],
};

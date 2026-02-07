/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(integration|e2e).test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@collectors/(.*)$': '<rootDir>/src/collectors/$1',
    '^@processors/(.*)$': '<rootDir>/src/processors/$1',
    '^@lambda/(.*)$': '<rootDir>/src/lambda/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.ts'],
  setupFiles: ['<rootDir>/tests/setup.env.ts'],
  testTimeout: 60000,
  verbose: true,
  bail: 1,
  maxWorkers: 2,
  forceExit: true,
  detectOpenHandles: true,
};

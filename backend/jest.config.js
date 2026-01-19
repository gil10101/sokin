/**
 * Jest Configuration for Sokin Backend
 * 
 * Configured for TypeScript with ts-jest transformer.
 * Targets 50% code coverage across controllers, middleware, and utilities.
 */

/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Node environment for backend testing
  testEnvironment: 'node',
  
  // Root directory for tests
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  
  // Module path aliases matching tsconfig
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Setup file for test environment
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    }],
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*.ts',
    '!src/index.ts', // Entry point excluded
  ],
  
  // Coverage thresholds - varied targets per metric (branches: 35%, functions: 55%, lines/statements: 50%)
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 55,
      lines: 50,
      statements: 50,
    },
  },
  
  // Coverage output directory
  coverageDirectory: 'coverage',
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Test timeout (10 seconds)
  testTimeout: 10000,
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
};



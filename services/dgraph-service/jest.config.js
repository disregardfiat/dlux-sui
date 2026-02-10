module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@dlux-sui/types$': '<rootDir>/../../shared/types/src'
  }
};

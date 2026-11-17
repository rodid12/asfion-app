module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/tests/mocks/react-native.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.tsx'],
  clearMocks: true,
};

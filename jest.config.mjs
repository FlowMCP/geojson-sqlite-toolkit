export default {
    testEnvironment: 'node',
    testMatch: [ '<rootDir>/tests/**/*.test.mjs' ],
    collectCoverageFrom: [
        'src/**/*.mjs',
        '!src/index.mjs'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [ 'text', 'lcov', 'html' ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    transform: {},
    moduleFileExtensions: [ 'mjs', 'js', 'json' ]
}

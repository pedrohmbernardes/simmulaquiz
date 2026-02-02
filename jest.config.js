module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Diz ao Jest para procurar arquivos que terminam com .test.ts
    testMatch: ['**/*.test.ts'],
    // Mapeia o @/ para a pasta raiz, igual ao seu tsconfig
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    // Ignora node_modules e .next
    testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};
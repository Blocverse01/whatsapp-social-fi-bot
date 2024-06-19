import { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    preset: 'ts-jest',
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        '@/(.*)': '<rootDir>/src/$1',
    },
    setupFiles: ['dotenv/config'],
};

export default jestConfig;

import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.spec.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 60000, globalSetup: ['test/global-setup.ts'] },
});

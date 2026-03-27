import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3000/api/v1',
  },
  reporter: 'list',
});

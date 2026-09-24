import { defineConfig } from '@playwright/test';

const webPort = 3100;
const apiPort = 3101;

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start --workspace=@poker/api',
      cwd: '../..',
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      env: {
        API_PORT: String(apiPort),
        LOG_LEVEL: 'error',
        NODE_ENV: 'test',
        PUBLIC_ORIGIN: `http://127.0.0.1:${webPort}`,
      },
    },
    {
      command: 'npm run dev --workspace=@poker/web',
      cwd: '../..',
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        WEB_PORT: String(webPort),
        NEXT_DIST_DIR: '.next-e2e',
        API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
      },
    },
  ],
});

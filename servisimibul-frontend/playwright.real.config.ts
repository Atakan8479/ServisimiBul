import { defineConfig, devices } from '@playwright/test'

const frontendPort = process.env.J03_FRONTEND_PORT ?? '4174'
const backendPort = process.env.J03_BACKEND_PORT ?? '8081'
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const backendCommand =
  process.platform === 'win32'
    ? '.\\mvnw.cmd --batch-mode spring-boot:run'
    : './mvnw --batch-mode spring-boot:run'

export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 300_000,
  use: {
    baseURL: frontendUrl,
    channel: !process.env.CI && process.platform === 'win32' ? 'msedge' : undefined,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    {
      name: 'real-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      cwd: '../servisimibul-backend',
      url: `http://127.0.0.1:${backendPort}/readyz`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        BACKEND_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
        VITE_EMAIL_VERIFICATION_REQUIRED: 'false',
      },
    },
  ],
})

import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

// Test credentials live in client/.env.e2e (gitignored by the root `.env.*`
// rule). Loaded by hand rather than via dotenv so e2e adds no dependency, and
// kept out of the command line so they never reach shell history.
const envFile = fileURLToPath(new URL("./.env.e2e", import.meta.url));

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const [, key, rawValue] = match;
      process.env[key] ??= rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

export const STORAGE_STATE = fileURLToPath(
  new URL("./playwright/.auth/player.json", import.meta.url)
);

// Before the first successful sign-in there is no saved session. Pointing a
// project at a file that doesn't exist fails the run with an ENOENT that says
// nothing useful, so run signed-out instead and let the specs report the real
// problem: no credentials.
const savedSession = existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined;

export default defineConfig({
  testDir: "./e2e",
  // The app talks to a live Supabase database and a real Firebase project, so
  // parallel workers would race each other over the same rows. One worker.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: savedSession },
      dependencies: ["setup"],
    },
    {
      // The primary width: people open this standing next to a pitch.
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: savedSession },
      dependencies: ["setup"],
    },
  ],

  // Attaches to an already-running dev server; only starts one if the port is
  // free. The server on :3000 (and Redis behind it) must be up separately —
  // Playwright does not manage it.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

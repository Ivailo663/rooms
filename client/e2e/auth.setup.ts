import { test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

setup("sign in and save the session", async ({ page }) => {
  setup.skip(
    !email || !password,
    "E2E_EMAIL / E2E_PASSWORD missing — add them to client/.env.e2e"
  );

  await page.goto("/auth");

  await page.getByPlaceholder("you@example.com").fill(email!);
  await page.getByPlaceholder("••••••••").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The auth store redirects to home once Firebase reports a user and the
  // /user round-trip resolves, so landing on "/" is the real signal that the
  // session is usable — not merely that the form submitted.
  await page.waitForURL("/");

  // Firebase keeps the session in IndexedDB, which storageState ignores unless
  // asked. Without this flag the saved file looks fine and every test that
  // reuses it starts logged out.
  await page.context().storageState({ path: STORAGE_STATE, indexedDB: true });
});

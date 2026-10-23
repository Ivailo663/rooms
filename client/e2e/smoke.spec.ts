import { test, expect } from "@playwright/test";

// A floor, not a suite: enough to prove the harness, the dev servers, the
// Firebase session and the API are all actually wired together. Q writes real
// coverage per change on top of this.
test("an authenticated session lands on home, not the auth screen", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Rooms" })).toHaveCount(0);
});

test("the client reaches the API without an auth error", async ({ page }) => {
  const failures: string[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("localhost:3000") && response.status() >= 400) {
      failures.push(`${response.status()} ${url}`);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(failures, `failing API calls:\n${failures.join("\n")}`).toEqual([]);
});

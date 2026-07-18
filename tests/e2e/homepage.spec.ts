import { test, expect } from "@playwright/test";

// Smoke test for the public landing page — the one path that needs no
// database, no OAuth app, and no agent to be configured, so it's safe to
// run in any environment. See test plan artifact
// (~/.gstack/projects/HIMURAw-planoo/zamto-main-eng-review-test-plan-*.md)
// for the full critical-path list once auth fixtures exist.
test("landing page shows the sign-in CTA and pricing when signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Google ile ücretsiz başla" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fiyatlandırma" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solo Developer" })).toBeVisible();
});

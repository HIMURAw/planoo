import { test, expect } from "@playwright/test";

// Smoke test for the signed-out landing state — the one path that needs no
// database, no Figma OAuth app, and no agent to be configured, so it's safe
// to run in any environment. See test plan artifact
// (~/.gstack/projects/HIMURAw-planoo/zamto-main-eng-review-test-plan-*.md)
// for the full critical-path list once auth fixtures exist.
test("landing page shows the Figma connect CTA when signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Figma ile bağlan" })).toBeVisible();
});

import { argosScreenshot } from "@argos-ci/playwright";
import { test } from "@playwright/test";

test("screenshot homepage", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await argosScreenshot(page, "homepage");
});

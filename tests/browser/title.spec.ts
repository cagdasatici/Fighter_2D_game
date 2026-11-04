import { expect, test } from "@playwright/test";

test("title loads with the menu and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await expect(page.locator("h1.kb-logo")).toHaveText("Knockout Bash");
  for (const label of ["Play Online", "Versus CPU", "Local 2P", "Training", "Settings", "How to Play"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Play Online" })).toBeFocused();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

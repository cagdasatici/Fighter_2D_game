import { expect, test } from "@playwright/test";

// TXT: Esc goes back from every menu screen, settings persist and reset, stage buttons show display names.
// Set KB_SHOTS=1 to also save docs/test-results/TXT-*.png.
const shot = async (page: import("@playwright/test").Page, name: string): Promise<void> => {
  if (process.env["KB_SHOTS"] === "1") await page.screenshot({ path: `docs/test-results/TXT-${name}.png` });
};

test("menus: back/escape, settings persistence + reset, how to play tabs, stage names", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await shot(page, "title");

  await page.getByRole("button", { name: "Settings" }).click();
  for (const s of ["Audio", "Gameplay", "Controls"]) await expect(page.locator("legend", { hasText: s })).toBeVisible();
  await page.getByLabel("CPU difficulty").selectOption("hard");
  await expect(page.getByText("Quick reactions, blocks most attacks, combos.")).toBeVisible();
  await page.getByRole("button", { name: "P1 Light Punch: U" }).click();
  await expect(page.getByText("Press a key for P1 Light Punch. Esc cancels.")).toBeVisible();
  await page.keyboard.press("KeyK");
  await expect(page.getByText("P1 Light Punch is now K. It was used by P1 Heavy Kick, which moved to U.")).toBeVisible();
  await shot(page, "settings");
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("CPU difficulty")).toHaveValue("hard");
  await expect(page.getByRole("button", { name: "P1 Light Punch: K" })).toBeVisible();
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByLabel("CPU difficulty")).toHaveValue("normal");
  await expect(page.getByRole("button", { name: "P1 Light Punch: U" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("h1.kb-logo")).toBeVisible();

  await page.getByRole("button", { name: "How to Play" }).click();
  await page.getByRole("tab", { name: "Touch" }).click();
  await expect(page.getByText("SUPER", { exact: true }).first()).toBeVisible();
  await shot(page, "howto-touch");
  await page.getByRole("tab", { name: "Moves" }).click();
  await expect(page.getByText("Rivet Shot").first()).toBeVisible();
  await shot(page, "howto-moves");
  await page.keyboard.press("Escape");
  await expect(page.locator("h1.kb-logo")).toBeVisible();

  await page.getByRole("button", { name: "Versus CPU" }).click();
  for (const n of ["Rooftop", "Bamboo Grove", "Volcano"]) await expect(page.getByRole("button", { name: n, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "rooftop", exact: true })).toHaveCount(0);
  await shot(page, "charselect");
  await page.keyboard.press("Escape");
  await expect(page.locator("h1.kb-logo")).toBeVisible();
  expect(errors).toEqual([]);
});

test("admin page loads (decision 0011 gap) and explains a host without an admin password", async ({ page }) => {
  await page.goto("/admin.html");
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Admin is not configured on this host.")).toBeVisible();
  await shot(page, "admin");
});

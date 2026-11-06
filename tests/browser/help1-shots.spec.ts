import { expect, test } from "@playwright/test";

// HELP1: pause Move List panel + in-match hint screenshots. Run with HELP1_SHOTS=<dir>; skipped otherwise.
const OUT = process.env["HELP1_SHOTS"];
type K = { state: { phase: string }; step: (i: [number, number]) => void; start: (m: string, c: string[], s: string) => void };

test("HELP1 screenshots", async ({ page }) => {
  test.skip(!OUT, "set HELP1_SHOTS to a directory");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("kb.settings.v1", JSON.stringify({ musicOn: false })));
  await page.reload();
  await page.evaluate(() => (window as unknown as { __kb: K }).__kb.start("cpu", ["bolt", "kaze"], "rooftop"));
  await page.keyboard.press("Escape"); // pause: loop stops ticking, render keeps running
  await page.getByRole("button", { name: "Move List" }).click();
  await expect(page.getByRole("heading", { name: "Move List" })).toBeVisible();
  await expect(page.getByText("Rivet Shot (↓↘→ + HP)").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/HELP1-movelist.png` });
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  await page.evaluate(`(() => { const k = window.__kb; while (k.state.phase !== 'fight') k.step([0, 0]); for (let i = 0; i < 15; i++) k.step([0, 0]); })()`);
  await page.addStyleTag({ content: ".kb-ui { display: none !important; }" });
  await page.waitForTimeout(150);
  await page.locator("canvas").first().screenshot({ path: `${OUT}/HELP1-hint.png` });
  expect(errors).toEqual([]);
});

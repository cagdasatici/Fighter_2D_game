import { expect, test } from "@playwright/test";
import { canvasVariety, kb, waitPhase } from "./helpers.js";

test("Versus CPU match starts, canvas draws and a keyboard combo hits", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  // Easy CPU so the scripted attack is not always blocked.
  await page.evaluate(() => localStorage.setItem("kb.settings.v1", JSON.stringify({ difficulty: "easy", musicOn: false })));
  await page.reload();
  await page.getByRole("button", { name: "Versus CPU" }).click();
  await expect(page.getByRole("heading", { name: "Character Select" })).toBeVisible();
  await page.keyboard.press("KeyU"); // P1 locks the first fighter
  await page.keyboard.press("KeyA"); // cursor back to the first fighter: a mirror match, no zoning CPU (decision 0018)
  await page.keyboard.press("KeyU"); // opponent
  await waitPhase(page, "fight");
  const s0 = (await kb(page))!;
  expect(s0.hp[0]).toBeGreaterThan(0);
  expect(await canvasVariety(page)).toBeGreaterThan(8);

  // Walk in (D held), then mash LP / HP / HK until P2 takes a hit (comboHits > 0 or hp drops).
  let hit = false;
  for (let t = 0; t < 80 && !hit; t++) {
    const v = (await kb(page))!;
    // The CPU can now jump onto a platform (HIGH is one jump away, decision 0018); wait until it comes down.
    if (v.platform[1] >= 0) { await page.waitForTimeout(300); continue; }
    const gap = v.x[1] - v.x[0]; // units (PX = 100 per pixel)
    if (Math.abs(gap) > 60 * 100) { const key = gap > 0 ? "KeyD" : "KeyA"; await page.keyboard.down(key); await page.waitForTimeout(150); await page.keyboard.up(key); }
    for (const k of ["KeyU", "KeyU", "KeyI", "KeyK"]) { await page.keyboard.press(k); await page.waitForTimeout(60); }
    const w = (await kb(page))!;
    hit = w.comboHits[1] > 0 || w.hp[1] < s0.hp[1];
  }
  expect(hit).toBe(true);
  expect((await kb(page))!.frame).toBeGreaterThan(s0.frame);
});
